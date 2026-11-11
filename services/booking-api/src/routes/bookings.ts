import { Router, type Request } from 'express';
import { prisma } from '../db';
import { forbidden, notFound } from '../errors';
import { paginated, toBookingDto } from '../mappers';
import { requireAuth } from '../middleware/auth';
import { cancelBooking, createBooking } from '../services/bookingService';
import { getNow } from '../utils/clock';
import { bookingsQuerySchema, createBookingSchema, isUuid, parse } from '../validation';

export const bookingsRouter = Router();
bookingsRouter.use(requireAuth); // every booking endpoint needs a logged-in user

/** Loads a booking the current user may see: 404 if missing, 403 if someone else's. */
async function findBookingForUser(req: Request) {
  const id = req.params.id;
  const booking = isUuid(id) ? await prisma.booking.findUnique({ where: { id } }) : null;
  if (!booking) throw notFound('Booking');

  const user = req.user!;
  if (user.role !== 'ADMIN' && booking.userId !== user.id) {
    throw forbidden('You can only access your own bookings');
  }
  return booking;
}

bookingsRouter.post('/', async (req, res) => {
  const body = parse(createBookingSchema, req.body ?? {});
  const booking = await createBooking({ ...body, userId: req.user!.id, now: getNow(req) });
  res.status(201).location(`/bookings/${booking.id}`).json(toBookingDto(booking));
});

// Guests see their own bookings; admins see all bookings.
bookingsRouter.get('/', async (req, res) => {
  const query = parse(bookingsQuerySchema, req.query);
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const where = req.user!.role === 'ADMIN' ? {} : { userId: req.user!.id };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);
  res.json(paginated(bookings.map(toBookingDto), page, limit, total));
});

bookingsRouter.get('/:id', async (req, res) => {
  const booking = await findBookingForUser(req);
  res.json(toBookingDto(booking));
});

bookingsRouter.post('/:id/cancel', async (req, res) => {
  const booking = await findBookingForUser(req);
  const cancelled = await cancelBooking(booking, req.user!.role, getNow(req));
  res.json(toBookingDto(cancelled));
});
