import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { conflict, isUniqueViolation, notFound } from '../errors';
import { paginated, toRoomDto } from '../mappers';
import { optionalAuth, requireAdmin, requireAuth } from '../middleware/auth';
import { calculatePrice } from '../pricing';
import { BLOCKING_STATUSES, validateStay } from '../rules';
import { getNow } from '../utils/clock';
import { nightsBetween, startOfUtcDay } from '../utils/dates';
import {
  availabilityQuerySchema,
  createRoomSchema,
  isUuid,
  parse,
  patchRoomSchema,
  quoteQuerySchema,
  replaceRoomSchema,
  roomsQuerySchema,
} from '../validation';

export const roomsRouter = Router();

const ROOM_NUMBER_TAKEN = () => conflict('ROOM_NUMBER_TAKEN', 'A room with this number already exists');

async function findRoomOr404(id: unknown) {
  const room = isUuid(id) ? await prisma.room.findUnique({ where: { id } }) : null;
  if (!room) throw notFound('Room');
  return room;
}

// GET /rooms — public list. Inactive rooms are hidden (rule 11),
// unless an admin asks for ?includeInactive=true.
roomsRouter.get('/', optionalAuth, async (req, res) => {
  const query = parse(roomsQuerySchema, req.query);
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const showInactive = query.includeInactive === 'true' && req.user?.role === 'ADMIN';

  const where: Prisma.RoomWhereInput = {
    ...(showInactive ? {} : { isActive: true }),
    ...(query.type && { type: query.type }),
  };
  const [rooms, total] = await Promise.all([
    prisma.room.findMany({ where, orderBy: { number: 'asc' }, skip: (page - 1) * limit, take: limit }),
    prisma.room.count({ where }),
  ]);
  res.json(paginated(rooms.map(toRoomDto), page, limit, total));
});

// GET /rooms/availability — active rooms that are free for the whole stay.
// Must be registered before /:id so "availability" is not treated as an id.
roomsRouter.get('/availability', async (req, res) => {
  const query = parse(availabilityQuerySchema, req.query);
  const { checkIn, checkOut } = validateStay(query.checkIn, query.checkOut, getNow(req));
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const where: Prisma.RoomWhereInput = {
    isActive: true,
    capacity: { gte: query.guests ?? 1 },
    ...(query.type && { type: query.type }),
    // no blocking booking that overlaps [checkIn, checkOut)
    bookings: {
      none: {
        status: { in: [...BLOCKING_STATUSES] },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    },
  };
  const [rooms, total] = await Promise.all([
    prisma.room.findMany({ where, orderBy: { number: 'asc' }, skip: (page - 1) * limit, take: limit }),
    prisma.room.count({ where }),
  ]);

  const nights = nightsBetween(checkIn, checkOut);
  const items = rooms.map((room) => ({
    ...toRoomDto(room),
    nights,
    totalPrice: Number(calculatePrice(room.pricePerNight, checkIn, checkOut).totalPrice),
  }));
  res.json(paginated(items, page, limit, total));
});

// GET /rooms/:id/quote — price of a stay, night by night (used by the room details page).
// Nightly prices are NOT rounded; only the total is (rule 10), so the sum of the rounded
// nightly prices shown in a UI can differ by a cent from totalPrice.
roomsRouter.get('/:id/quote', async (req, res) => {
  const room = await findRoomOr404(req.params.id);
  const query = parse(quoteQuerySchema, req.query);
  const { checkIn, checkOut } = validateStay(query.checkIn, query.checkOut, getNow(req));
  if (!room.isActive) throw conflict('ROOM_INACTIVE', 'Room is not available for booking');

  const { nights, totalPrice } = calculatePrice(room.pricePerNight, checkIn, checkOut);
  res.json({
    roomId: room.id,
    checkIn: query.checkIn,
    checkOut: query.checkOut,
    pricePerNight: Number(room.pricePerNight),
    nights: nights.map((n) => ({ date: n.date, isWeekend: n.isWeekend, price: Number(n.price) })),
    totalPrice: Number(totalPrice),
  });
});

roomsRouter.get('/:id', async (req, res) => {
  const room = await findRoomOr404(req.params.id);
  res.json(toRoomDto(room));
});

roomsRouter.post('/', requireAuth, requireAdmin, async (req, res) => {
  const body = parse(createRoomSchema, req.body ?? {});
  try {
    const room = await prisma.room.create({ data: body });
    res.status(201).location(`/rooms/${room.id}`).json(toRoomDto(room));
  } catch (err) {
    if (isUniqueViolation(err)) throw ROOM_NUMBER_TAKEN();
    throw err;
  }
});

// PUT replaces number/type/capacity/pricePerNight. isActive can only change via PATCH.
roomsRouter.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const body = parse(replaceRoomSchema, req.body ?? {});
  const room = await findRoomOr404(req.params.id);
  try {
    const updated = await prisma.room.update({ where: { id: room.id }, data: body });
    res.json(toRoomDto(updated));
  } catch (err) {
    if (isUniqueViolation(err)) throw ROOM_NUMBER_TAKEN();
    throw err;
  }
});

// PATCH updates only the fields sent. Used to (de)activate a room.
roomsRouter.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const body = parse(patchRoomSchema, req.body ?? {});
  const room = await findRoomOr404(req.params.id);

  // Rule 16: cannot deactivate a room that has upcoming (or ongoing) confirmed stays.
  if (body.isActive === false) {
    const today = startOfUtcDay(getNow(req));
    const upcoming = await prisma.booking.count({
      where: { roomId: room.id, status: 'CONFIRMED', checkOut: { gt: today } },
    });
    if (upcoming > 0) {
      throw conflict(
        'ROOM_HAS_FUTURE_BOOKINGS',
        `Room has ${upcoming} upcoming confirmed booking(s) and cannot be deactivated`,
      );
    }
  }

  try {
    const updated = await prisma.room.update({ where: { id: room.id }, data: body });
    res.json(toRoomDto(updated));
  } catch (err) {
    if (isUniqueViolation(err)) throw ROOM_NUMBER_TAKEN();
    throw err;
  }
});
