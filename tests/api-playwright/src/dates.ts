// Date helpers using the catalog's notation. All dates are UTC, "YYYY-MM-DD".
import { env } from './env';

const DAY_MS = 24 * 60 * 60 * 1000;

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const iso = (date: Date) => date.toISOString().slice(0, 10);

/** D+n: today (UTC) plus n days. day(-1) is yesterday. */
export function day(offset: number): string {
  return iso(new Date(todayUtc().getTime() + offset * DAY_MS));
}

/** Adds n days to an ISO date. */
export function addDays(isoDate: string, n: number): string {
  return iso(new Date(new Date(`${isoDate}T00:00:00Z`).getTime() + n * DAY_MS));
}

/** MON+n: the first Monday on or after D+60, plus n days (MON+4 is a Friday). */
export function monday(plus = 0): string {
  let offset = 60;
  while (new Date(`${day(offset)}T00:00:00Z`).getUTCDay() !== 1) offset++;
  return day(offset + plus);
}

/** CHECKIN(b): the exact moment a stay starts (check-in date at CHECKIN_HOUR_UTC). */
export function checkInMoment(checkIn: string): Date {
  return new Date(new Date(`${checkIn}T00:00:00Z`).getTime() + env.checkinHourUtc * 60 * 60 * 1000);
}

/** Header that makes booking-api treat `moment` as "now" (APP_ENV=test only). */
export function testNow(moment: Date | string): Record<string, string> {
  return { 'X-Test-Now': typeof moment === 'string' ? moment : moment.toISOString() };
}

export const HOUR_MS = 60 * 60 * 1000;
