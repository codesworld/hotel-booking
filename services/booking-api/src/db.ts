import './config'; // makes sure DATABASE_URL is set before Prisma starts
import { PrismaClient } from '@prisma/client';
import { isDeadlock } from './errors';

export const prisma = new PrismaClient();

const MAX_ATTEMPTS = 3;

/**
 * Runs a database write and retries it if Postgres aborted it because of a deadlock.
 *
 * Why this is needed: the "bookings_no_overlap" exclusion constraint is checked on every
 * INSERT and UPDATE of a booking. When two requests write OVERLAPPING stays for the same
 * room at the same moment, each one can end up waiting for the other's uncommitted row.
 * Postgres detects that deadlock and aborts one of them (error 40P01). Retrying is safe:
 * by then the other request has finished, so the retry either succeeds or fails with the
 * normal "room unavailable" violation → 409.
 */
export async function retryOnDeadlock<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (err) {
      if (!isDeadlock(err) || attempt >= MAX_ATTEMPTS) throw err;
      console.warn(`Database deadlock (attempt ${attempt}/${MAX_ATTEMPTS}), retrying`);
    }
  }
}
