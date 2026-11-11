import { test, expect, smoke, regression } from '../src/fixtures';
import { expectError, expectOk } from '../src/assertions';
import { checkInMoment, day, HOUR_MS, testNow } from '../src/dates';
import type { TestData } from '../src/testData';
import { UNKNOWN_ID } from '../src/testData';

/** Booking B by a fresh guest on OWN_ROOM (default D+30 → D+32). */
async function bookingB(data: TestData, checkIn = day(30), checkOut = day(32)) {
  const room = await data.createRoom();
  const owner = await data.freshUser();
  const booking = await data.createBooking(owner.token, room.id, { checkIn, checkOut });
  return { owner, booking };
}

test.describe('Cancellation (CANC)', () => {
  test('CANC-001 Owner cancels more than 48 h ahead', smoke, async ({ api, data }) => {
    const { owner, booking } = await bookingB(data);
    const res = await api.post(`/bookings/${booking.id}/cancel`, { token: owner.token });
    expectOk(res, 200, 'booking');
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.cancelledAt).not.toBeNull();

    const read = await data.getBooking(booking.id, owner.token);
    expect(read.status).toBe('CANCELLED');
    expect(read.cancelledAt).toBe(res.body.cancelledAt);
  });

  test('CANC-002 Cancel an already cancelled booking', regression, async ({ api, data }) => {
    const { owner, booking } = await bookingB(data);
    const first = await api.post(`/bookings/${booking.id}/cancel`, { token: owner.token });
    expectOk(first, 200, 'booking');

    expectError(await api.post(`/bookings/${booking.id}/cancel`, { token: owner.token }), 409, 'ALREADY_CANCELLED');
    expect((await data.getBooking(booking.id)).cancelledAt).toBe(first.body.cancelledAt);
  });

  test('CANC-003 Seeded cancelled booking cannot be cancelled again', regression, async ({ api, tokens, seed }) => {
    expectError(await api.post(`/bookings/${seed.booking(2).id}/cancel`, { token: tokens.g1 }), 409, 'ALREADY_CANCELLED');
  });

  test('CANC-004 Guest cancels inside 48 h', regression, async ({ api, tokens, seed, data }) => {
    const sb6 = seed.booking(6);
    const res = await api.post(`/bookings/${sb6.id}/cancel`, { token: tokens.g2 });
    expectError(res, 422, 'CANCELLATION_WINDOW_PASSED');
    expect(res.body.error.message).toContain('48 hours');
    expect((await data.getBooking(sb6.id)).status).toBe('CONFIRMED');
  });

  const boundary: [string, string, number, number][] = [
    // id, title, offset from CHECKIN(B) − 48h in ms, expected status
    ['CANC-005', '48 h boundary: exactly 48 h is too late', 0, 422],
    ['CANC-006', '48 h boundary: 48 h + 1 s is allowed', -1000, 200],
    ['CANC-007', '48 h boundary: 47 h 59 m 59 s is too late', +1000, 422],
  ];
  for (const [id, title, offsetMs, status] of boundary) {
    test(`${id} ${title}`, regression, async ({ api, data }) => {
      const { owner, booking } = await bookingB(data);
      const now = new Date(checkInMoment(booking.checkIn).getTime() - 48 * HOUR_MS + offsetMs);
      const res = await api.post(`/bookings/${booking.id}/cancel`, { token: owner.token, headers: testNow(now) });

      if (status === 200) {
        expectOk(res, 200, 'booking');
        expect(res.body.status).toBe('CANCELLED');
      } else {
        expectError(res, 422, 'CANCELLATION_WINDOW_PASSED');
        expect((await data.getBooking(booking.id)).status).toBe('CONFIRMED');
      }
    });
  }

  test('CANC-008 Admin cancels inside 48 h', regression, async ({ api, tokens, data }) => {
    const { booking } = await bookingB(data, day(1), day(2));
    const res = await api.post(`/bookings/${booking.id}/cancel`, { token: tokens.admin });
    expectOk(res, 200, 'booking');
    expect(res.body.status).toBe('CANCELLED');
  });

  test("CANC-009 Admin cancels another user's booking", regression, async ({ api, tokens, data }) => {
    const { owner, booking } = await bookingB(data);
    const res = await api.post(`/bookings/${booking.id}/cancel`, { token: tokens.admin });
    expectOk(res, 200, 'booking');
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.userId).toBe(owner.id);
  });

  test('CANC-010 Guest cannot cancel after check-in', regression, async ({ api, data }) => {
    const { owner, booking } = await bookingB(data);
    const now = new Date(checkInMoment(booking.checkIn).getTime() + HOUR_MS);
    const res = await api.post(`/bookings/${booking.id}/cancel`, { token: owner.token, headers: testNow(now) });
    expectError(res, 422, 'CANCELLATION_WINDOW_PASSED');
    expect((await data.getBooking(booking.id)).status).toBe('CONFIRMED');
  });

  test('CANC-011 Failed-payment booking cannot be cancelled', regression, async ({ api, tokens, seed, data }) => {
    const sb4 = seed.booking(4);
    expectError(await api.post(`/bookings/${sb4.id}/cancel`, { token: tokens.g2 }), 409, 'BOOKING_NOT_CANCELLABLE');
    expect((await data.getBooking(sb4.id)).status).toBe('PAYMENT_FAILED');
  });

  test('CANC-012 Cancel an unknown booking', regression, async ({ api, tokens }) => {
    expectError(await api.post(`/bookings/${UNKNOWN_ID}/cancel`, { token: tokens.g1 }), 404, 'NOT_FOUND');
  });
});
