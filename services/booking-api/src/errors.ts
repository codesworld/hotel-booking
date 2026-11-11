// Every error the API returns is an AppError. The error handler turns it into:
//   { "error": { "code": "...", "message": "...", "field": "..." } }

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly field?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const validationError = (message: string, field?: string) =>
  new AppError(400, 'VALIDATION_ERROR', message, field);

export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found`);

export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, 'FORBIDDEN', message);

export const conflict = (code: string, message: string) => new AppError(409, code, message);

// Prisma error helpers -------------------------------------------------------

// Unique constraint violated (e.g. duplicate email or room number).
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

// The "bookings_no_overlap" exclusion constraint was violated (room already booked).
export function isOverlapViolation(err: unknown): boolean {
  return err instanceof Error && err.message.includes('bookings_no_overlap');
}

// Postgres aborted the statement because of a deadlock (error code 40P01).
// See retryOnDeadlock() in db.ts.
export function isDeadlock(err: unknown): boolean {
  return err instanceof Error && err.message.includes('40P01');
}
