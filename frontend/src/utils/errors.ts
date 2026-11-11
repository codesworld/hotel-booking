// Turns API errors into messages for people. The API's own messages are already readable
// (e.g. "checkOut must be after checkIn"), so most are shown as they are; a few codes get a
// friendlier explanation.
import { ApiError } from '../api/client';

const FRIENDLY: Record<string, string> = {
  INVALID_CREDENTIALS: 'Invalid email or password.',
  EMAIL_TAKEN: 'An account with this email already exists.',
  ROOM_UNAVAILABLE: 'Sorry, this room was just booked for some of these dates. Please choose other dates or another room.',
  ROOM_INACTIVE: 'This room is not available for booking.',
  PAYMENT_DECLINED: 'Your card was declined. The booking was not confirmed and no money was taken.',
  PAYMENT_TIMEOUT: 'The payment provider did not respond in time. The booking was not confirmed. Please try again.',
  PAYMENT_SERVICE_ERROR: 'The payment provider is unavailable right now. The booking was not confirmed. Please try again later.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return FRIENDLY[error.code] ?? error.message;
  return 'Something went wrong. Please try again.';
}

/** Field name the API blamed (e.g. "checkOut"), to show the message next to that input. */
export const errorField = (error: unknown) => (error instanceof ApiError ? error.field : undefined);
export const errorCode = (error: unknown) => (error instanceof ApiError ? error.code : undefined);
