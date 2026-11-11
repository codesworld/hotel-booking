import { test, expect, regression } from '../src/fixtures';
import { expectError, expectOk } from '../src/assertions';
import { day } from '../src/dates';
import type { Booking } from '../src/seed';
import { newUser } from '../src/testData';

const count = (statuses: number[], status: number) => statuses.filter((s) => s === status).length;

test.describe('Concurrency (CONC)', () => {
  test('CONC-001 Parallel identical bookings: exactly one wins', regression, async ({ data }) => {
    const room = await data.createRoom();
    const users = [await data.freshUser(), await data.freshUser()];

    // 10 requests fired at the same time, alternating between two guests
    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        data.book(users[i % 2].token, room.id, { checkIn: day(40), checkOut: day(42) }),
      ),
    );

    const statuses = responses.map((r) => r.status);
    expect(count(statuses, 201), `statuses: ${statuses}`).toBe(1);
    expect(count(statuses, 409), `statuses: ${statuses}`).toBe(9);
    for (const res of responses.filter((r) => r.status === 409)) expectError(res, 409, 'ROOM_UNAVAILABLE');

    // State: exactly one CONFIRMED booking for the room across both users
    const bookings = [
      ...(await data.allPages<Booking>('/bookings', users[0].token)),
      ...(await data.allPages<Booking>('/bookings', users[1].token)),
    ];
    expect(bookings.filter((b) => b.roomId === room.id && b.status === 'CONFIRMED')).toHaveLength(1);
  });

  test('CONC-002 Parallel overlapping (not identical) stays', regression, async ({ data }) => {
    const room = await data.createRoom();
    const user = await data.freshUser();
    const responses = await Promise.all([
      data.book(user.token, room.id, { checkIn: day(40), checkOut: day(43) }),
      data.book(user.token, room.id, { checkIn: day(42), checkOut: day(45) }),
    ]);
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
  });

  test('CONC-003 Parallel non-overlapping stays both succeed', regression, async ({ data }) => {
    const room = await data.createRoom();
    const user = await data.freshUser();
    const responses = await Promise.all([
      data.book(user.token, room.id, { checkIn: day(40), checkOut: day(42) }),
      data.book(user.token, room.id, { checkIn: day(42), checkOut: day(44) }),
    ]);
    for (const res of responses) expectOk(res, 201, 'booking');
  });

  test('CONC-004 Parallel cancel of the same booking', regression, async ({ api, data }) => {
    const room = await data.createRoom();
    const user = await data.freshUser();
    const booking = await data.createBooking(user.token, room.id);
    const responses = await Promise.all([
      api.post(`/bookings/${booking.id}/cancel`, { token: user.token }),
      api.post(`/bookings/${booking.id}/cancel`, { token: user.token }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expectError(responses.find((r) => r.status === 409)!, 409, 'ALREADY_CANCELLED');
  });

  test('CONC-005 Parallel register with the same email', regression, async ({ api }) => {
    const user = newUser();
    const responses = await Promise.all([
      api.post('/auth/register', { body: user }),
      api.post('/auth/register', { body: user }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expectError(responses.find((r) => r.status === 409)!, 409, 'EMAIL_TAKEN');
  });
});
