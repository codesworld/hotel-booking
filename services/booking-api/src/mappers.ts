// Turn database rows into API responses. This is the ONLY place that decides
// which fields leave the API — passwordHash is never included.
import type { Booking, Room, User } from '@prisma/client';
import { formatIsoDate } from './utils/dates';

export function toUserDto(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toRoomDto(room: Room) {
  return {
    id: room.id,
    number: room.number,
    type: room.type,
    capacity: room.capacity,
    pricePerNight: Number(room.pricePerNight),
    isActive: room.isActive,
  };
}

export function toBookingDto(booking: Booking) {
  return {
    id: booking.id,
    roomId: booking.roomId,
    userId: booking.userId,
    checkIn: formatIsoDate(booking.checkIn),
    checkOut: formatIsoDate(booking.checkOut),
    guests: booking.guests,
    totalPrice: Number(booking.totalPrice),
    status: booking.status,
    paymentId: booking.paymentId,
    createdAt: booking.createdAt.toISOString(),
    cancelledAt: booking.cancelledAt ? booking.cancelledAt.toISOString() : null,
  };
}

export function paginated<T>(items: T[], page: number, limit: number, total: number) {
  return { items, page, limit, total };
}
