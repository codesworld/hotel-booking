// Request validation schemas (zod) and the helper that turns validation
// failures into our standard 400 error.
import { z, ZodError } from 'zod';
import { validationError, AppError } from './errors';
import { parseIsoDate } from './utils/dates';

const msg = (message: string) => ({ message });

/** Validates `data` against `schema`. Throws a 400 VALIDATION_ERROR for the first problem found. */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw zodToAppError(result.error);
  return result.data;
}

function zodToAppError(err: ZodError): AppError {
  const issue = err.issues[0];
  const path = issue.path.join('.');

  if (issue.code === 'unrecognized_keys') {
    const field = path ? `${path}.${issue.keys[0]}` : issue.keys[0];
    return validationError(`Unknown field: ${field}`, field);
  }
  if (issue.code === 'invalid_type') {
    if (!path) return validationError('Request body must be a JSON object');
    if (issue.received === 'undefined') return validationError(`${path} is required`, path);
    return validationError(`${path} must be of type ${issue.expected}`, path);
  }
  if (issue.code === 'invalid_enum_value') {
    return validationError(`${path} must be one of: ${issue.options.join(', ')}`, path);
  }
  return validationError(path ? `${path} ${issue.message}` : issue.message, path || undefined);
}

export const isUuid = (value: unknown): value is string => z.string().uuid().safeParse(value).success;

// Reusable field schemas ---------------------------------------------------------

const isoDate = z
  .string()
  .refine((v) => parseIsoDate(v) !== null, msg('must be a valid date in YYYY-MM-DD format'));

const roomType = z.enum(['SINGLE', 'DOUBLE', 'SUITE']);

const roomNumber = z
  .string()
  .regex(/^[A-Za-z0-9-]{1,10}$/, msg('must be 1-10 characters (letters, digits or "-")'));

const capacity = z
  .number()
  .int(msg('must be an integer'))
  .min(1, msg('must be between 1 and 6'))
  .max(6, msg('must be between 1 and 6'));

const hasAtMostTwoDecimals = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9;
const pricePerNight = z
  .number()
  .positive(msg('must be greater than 0'))
  .max(99999999.99, msg('is too large'))
  .refine(hasAtMostTwoDecimals, msg('must have at most 2 decimal places'));

/** Query-string integer (query values always arrive as strings). */
const positiveIntQuery = (max?: number) =>
  z
    .string()
    .regex(/^\d+$/, msg('must be a positive integer'))
    .transform(Number)
    .refine((n) => n >= 1, msg('must be at least 1'))
    .refine((n) => max === undefined || n <= max, msg(`must be at most ${max}`));

const pagination = {
  page: positiveIntQuery().optional(),
  limit: positiveIntQuery(100).optional(),
};

// Auth --------------------------------------------------------------------------

export const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(msg('must be a valid email address')).max(254),
    password: z
      .string()
      .min(8, msg('must be at least 8 characters'))
      .max(72, msg('must be at most 72 characters')),
    fullName: z
      .string()
      .trim()
      .min(1, msg('must not be empty'))
      .max(100, msg('must be at most 100 characters')),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().min(1, msg('must not be empty')),
    password: z.string().min(1, msg('must not be empty')),
  })
  .strict();

// Rooms -------------------------------------------------------------------------

export const createRoomSchema = z
  .object({
    number: roomNumber,
    type: roomType,
    capacity,
    pricePerNight,
    isActive: z.boolean().optional(),
  })
  .strict();

// PUT replaces the room's details. isActive is NOT allowed here: use PATCH.
export const replaceRoomSchema = z
  .object({ number: roomNumber, type: roomType, capacity, pricePerNight })
  .strict();

export const patchRoomSchema = z
  .object({
    number: roomNumber.optional(),
    type: roomType.optional(),
    capacity: capacity.optional(),
    pricePerNight: pricePerNight.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, msg('Request body must contain at least one field'));

export const roomsQuerySchema = z.object({
  ...pagination,
  type: roomType.optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

export const quoteQuerySchema = z.object({
  checkIn: isoDate,
  checkOut: isoDate,
});

export const availabilityQuerySchema = z.object({
  ...pagination,
  checkIn: isoDate,
  checkOut: isoDate,
  guests: positiveIntQuery(6).optional(),
  type: roomType.optional(),
});

// Bookings ----------------------------------------------------------------------

export const createBookingSchema = z
  .object({
    roomId: z.string().uuid(msg('must be a valid UUID')),
    checkIn: isoDate,
    checkOut: isoDate,
    guests: z.number().int(msg('must be an integer')).min(1, msg('must be at least 1')),
    cardToken: z.string().min(1, msg('must not be empty')).max(100),
  })
  .strict();

export const bookingsQuerySchema = z.object({ ...pagination });
