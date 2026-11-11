// Business rules from PROJECT_PLAN.md section 4, in one place.
import { config } from './config';
import { validationError } from './errors';
import { addDays, nightsBetween, parseIsoDate, startOfUtcDay } from './utils/dates';

export const MAX_NIGHTS = 30; // rule 3
export const MAX_DAYS_AHEAD = 365; // rule 3
export const WEEKEND_SURCHARGE = 1.2; // rule 10: Friday and Saturday nights +20%
export const FREE_CANCELLATION_HOURS = 48; // rule 13

// Bookings in these statuses block the room (rule 7: PAYMENT_FAILED and CANCELLED do not).
export const BLOCKING_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED'] as const;

/**
 * Rules 1-3. Inputs must already be valid "YYYY-MM-DD" strings (checked by the schema).
 * Returns the parsed dates.
 */
export function validateStay(checkInText: string, checkOutText: string, now: Date) {
  const checkIn = parseIsoDate(checkInText)!;
  const checkOut = parseIsoDate(checkOutText)!;
  const today = startOfUtcDay(now);

  if (checkIn < today) {
    throw validationError('checkIn cannot be in the past', 'checkIn');
  }
  if (checkOut <= checkIn) {
    throw validationError('checkOut must be after checkIn', 'checkOut');
  }
  if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS) {
    throw validationError(`Maximum stay is ${MAX_NIGHTS} nights`, 'checkOut');
  }
  if (checkIn > addDays(today, MAX_DAYS_AHEAD)) {
    throw validationError(`checkIn cannot be more than ${MAX_DAYS_AHEAD} days ahead`, 'checkIn');
  }
  return { checkIn, checkOut };
}

/** The exact moment a stay starts: the check-in date at CHECKIN_HOUR_UTC (default 14:00 UTC). */
export function checkInMoment(checkIn: Date): Date {
  return new Date(checkIn.getTime() + config.checkinHourUtc * 60 * 60 * 1000);
}

/** Rule 13: a guest may cancel only if check-in is MORE than 48 hours away. */
export function isFreeCancellation(checkIn: Date, now: Date): boolean {
  const msUntilCheckIn = checkInMoment(checkIn).getTime() - now.getTime();
  return msUntilCheckIn > FREE_CANCELLATION_HOURS * 60 * 60 * 1000;
}
