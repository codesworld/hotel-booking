import type { Request } from 'express';
import { isTestEnv } from '../config';
import { validationError } from '../errors';

/**
 * Returns "now" for this request.
 *
 * Testability hook: when APP_ENV=test, a request may send the header
 *   X-Test-Now: 2026-12-01T14:00:00Z
 * to pretend the current time is different. This makes time-based rules
 * (past dates, 365-day window, 48h cancellation) testable to the second
 * without sleeps. The header is ignored in every other environment.
 */
export function getNow(req: Request): Date {
  if (isTestEnv()) {
    const header = req.header('X-Test-Now');
    if (header) {
      const fake = new Date(header);
      if (Number.isNaN(fake.getTime())) {
        throw validationError('X-Test-Now must be an ISO 8601 date-time', 'X-Test-Now');
      }
      return fake;
    }
  }
  return new Date();
}
