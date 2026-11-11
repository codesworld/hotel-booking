// Booking creation and cancellation: the core business logic.
import type { Booking, Prisma, Role } from '@prisma/client';
import { prisma, retryOnDeadlock } from '../db';
import { AppError, conflict, isOverlapViolation, notFound, validationError } from '../errors';
import { calculatePrice } from '../pricing';
import { BLOCKING_STATUSES, FREE_CANCELLATION_HOURS, checkInMoment, isFreeCancellation, validateStay } from '../rules';
import { requestPayment } from './paymentClient';

interface CreateBookingInput {
  userId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  cardToken: string;
  now: Date;
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  // Rules 1-3: dates
  const { checkIn, checkOut } = validateStay(input.checkIn, input.checkOut, input.now);

  // Room must exist (404) and be active (rule 11 → 409)
  const room = await prisma.room.findUnique({ where: { id: input.roomId } });
  if (!room) throw notFound('Room');
  if (!room.isActive) throw conflict('ROOM_INACTIVE', 'Room is not available for booking');

  // Rule 9: capacity
  if (input.guests > room.capacity) {
    throw validationError(`guests must be between 1 and ${room.capacity} for room ${room.number}`, 'guests');
  }

  // Rule 10: pricing
  const { totalPrice } = calculatePrice(room.pricePerNight, checkIn, checkOut);

  // Rules 5-8: the database exclusion constraint "bookings_no_overlap" rejects
  // overlapping bookings, even when two requests arrive at the same moment.
  const booking = await insertPendingBooking({
    roomId: room.id,
    userId: input.userId,
    checkIn,
    checkOut,
    guests: input.guests,
    totalPrice,
  });

  // Payment flow (PROJECT_PLAN.md section 5)
  const payment = await requestPayment({
    bookingId: booking.id,
    amount: Number(totalPrice),
    cardToken: input.cardToken,
  });
  const details = { bookingId: booking.id };

  switch (payment.outcome) {
    case 'APPROVED':
      return retryOnDeadlock(() =>
        prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'CONFIRMED', paymentId: payment.paymentId },
        }),
      );
    case 'DECLINED':
      await markPaymentFailed(booking.id, payment.paymentId);
      throw new AppError(402, 'PAYMENT_DECLINED', 'Payment was declined', undefined, details);
    case 'REJECTED':
      // The card token itself is invalid: treat it like any other 400 —
      // nothing is saved, so the pending booking is removed again.
      await retryOnDeadlock(() => prisma.booking.delete({ where: { id: booking.id } }));
      throw validationError(`cardToken was rejected by the payment provider: ${payment.message}`, 'cardToken');
    case 'TIMEOUT':
      await markPaymentFailed(booking.id, null);
      throw new AppError(504, 'PAYMENT_TIMEOUT', 'Payment service did not respond in time', undefined, details);
    case 'ERROR':
      await markPaymentFailed(booking.id, null);
      throw new AppError(502, 'PAYMENT_SERVICE_ERROR', 'Payment service is unavailable', undefined, details);
  }
}

/**
 * Inserts the booking as PENDING_PAYMENT.
 * Overlap with another blocking booking → 409 ROOM_UNAVAILABLE (exclusion constraint).
 */
async function insertPendingBooking(data: Omit<Prisma.BookingUncheckedCreateInput, 'status'>): Promise<Booking> {
  try {
    return await retryOnDeadlock(() => prisma.booking.create({ data: { ...data, status: 'PENDING_PAYMENT' } }));
  } catch (err) {
    if (isOverlapViolation(err)) {
      throw conflict('ROOM_UNAVAILABLE', 'Room is already booked for some of the selected dates');
    }
    throw err;
  }
}

async function markPaymentFailed(bookingId: string, paymentId: string | null) {
  await retryOnDeadlock(() =>
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'PAYMENT_FAILED', paymentId },
    }),
  );
}

/** Rules 12-14. The caller has already checked that the user is the owner or an admin. */
export async function cancelBooking(booking: Booking, userRole: Role, now: Date): Promise<Booking> {
  if (booking.status === 'CANCELLED') {
    throw conflict('ALREADY_CANCELLED', 'Booking is already cancelled');
  }
  if (booking.status === 'PAYMENT_FAILED') {
    throw conflict('BOOKING_NOT_CANCELLABLE', 'A booking with a failed payment cannot be cancelled');
  }
  if (userRole !== 'ADMIN' && !isFreeCancellation(booking.checkIn, now)) {
    throw new AppError(
      422,
      'CANCELLATION_WINDOW_PASSED',
      `Free cancellation is only possible more than ${FREE_CANCELLATION_HOURS} hours before check-in ` +
        `(${checkInMoment(booking.checkIn).toISOString()}). Please contact the hotel.`,
    );
  }

  // Only update if still cancellable: protects against two cancel requests at once.
  const result = await retryOnDeadlock(() =>
    prisma.booking.updateMany({
      where: { id: booking.id, status: { in: [...BLOCKING_STATUSES] } },
      data: { status: 'CANCELLED', cancelledAt: now },
    }),
  );
  if (result.count === 0) {
    throw conflict('ALREADY_CANCELLED', 'Booking is already cancelled');
  }
  return prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
}
