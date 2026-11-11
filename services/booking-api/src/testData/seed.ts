// Known dataset loaded by POST /test/seed.
// Booking dates are RELATIVE to "now", so the seed never goes out of date.
// Passwords come from environment variables (SEED_*), never from code.
import bcrypt from 'bcryptjs';
import type { BookingStatus, Room, RoomType, User } from '@prisma/client';
import { config } from '../config';
import { prisma } from '../db';
import { AppError } from '../errors';
import { toBookingDto, toRoomDto, toUserDto } from '../mappers';
import { calculatePrice } from '../pricing';
import { addDays, startOfUtcDay } from '../utils/dates';

export async function resetDatabase() {
  await prisma.$executeRaw`TRUNCATE TABLE "bookings", "rooms", "users" CASCADE`;
}

function seedEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new AppError(500, 'SEED_NOT_CONFIGURED', `Environment variable ${name} is not set`);
  return value;
}

const ROOMS: { number: string; type: RoomType; capacity: number; pricePerNight: number; isActive: boolean }[] = [
  { number: '101', type: 'SINGLE', capacity: 1, pricePerNight: 80.0, isActive: true },
  { number: '102', type: 'SINGLE', capacity: 2, pricePerNight: 95.5, isActive: true },
  { number: '201', type: 'DOUBLE', capacity: 2, pricePerNight: 120.0, isActive: true },
  { number: '202', type: 'DOUBLE', capacity: 3, pricePerNight: 145.75, isActive: true },
  { number: '301', type: 'SUITE', capacity: 4, pricePerNight: 250.0, isActive: true },
  { number: '302', type: 'SUITE', capacity: 6, pricePerNight: 399.99, isActive: false },
];

export async function seedDatabase(now: Date) {
  await resetDatabase();

  const createUser = async (prefix: string, fullName: string, role: 'ADMIN' | 'GUEST') =>
    prisma.user.create({
      data: {
        email: seedEnv(`${prefix}_EMAIL`).toLowerCase(),
        passwordHash: await bcrypt.hash(seedEnv(`${prefix}_PASSWORD`), config.bcryptRounds),
        fullName,
        role,
      },
    });

  const admin = await createUser('SEED_ADMIN', 'Alice Admin', 'ADMIN');
  const guest1 = await createUser('SEED_GUEST1', 'Gina Guest', 'GUEST');
  const guest2 = await createUser('SEED_GUEST2', 'Gary Guest', 'GUEST');

  const rooms: Record<string, Room> = {};
  for (const room of ROOMS) {
    rooms[room.number] = await prisma.room.create({ data: room });
  }

  const today = startOfUtcDay(now);
  const book = (
    user: User,
    roomNumber: string,
    fromDay: number,
    toDay: number,
    guests: number,
    status: BookingStatus,
    paymentId: string | null,
  ) => {
    const room = rooms[roomNumber];
    const checkIn = addDays(today, fromDay);
    const checkOut = addDays(today, toDay);
    return prisma.booking.create({
      data: {
        roomId: room.id,
        userId: user.id,
        checkIn,
        checkOut,
        guests,
        totalPrice: calculatePrice(room.pricePerNight, checkIn, checkOut).totalPrice,
        status,
        paymentId,
        cancelledAt: status === 'CANCELLED' ? now : null,
      },
    });
  };

  const bookings = [
    // guest1 — confirmed stay in 10 days (can be cancelled for free)
    await book(guest1, '201', 10, 13, 2, 'CONFIRMED', 'seed_pay_1'),
    // guest1 — cancelled (does not block room 202)
    await book(guest1, '202', 20, 22, 3, 'CANCELLED', 'seed_pay_2'),
    // guest1 — waiting for payment (blocks room 102)
    await book(guest1, '102', 40, 42, 2, 'PENDING_PAYMENT', null),
    // guest2 — payment failed (does not block room 101)
    await book(guest2, '101', 5, 7, 1, 'PAYMENT_FAILED', 'seed_pay_3'),
    // guest2 — confirmed suite stay (room 301 cannot be deactivated)
    await book(guest2, '301', 30, 35, 4, 'CONFIRMED', 'seed_pay_4'),
    // guest2 — confirmed, check-in tomorrow: inside the 48h window (guest cancel → 422)
    await book(guest2, '201', 1, 2, 2, 'CONFIRMED', 'seed_pay_5'),
  ];

  return {
    users: [admin, guest1, guest2].map(toUserDto),
    rooms: Object.values(rooms).map(toRoomDto),
    bookings: bookings.map(toBookingDto),
  };
}
