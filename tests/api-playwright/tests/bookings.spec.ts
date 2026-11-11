import { test, expect, smoke, regression } from '../src/fixtures';
import { expectError, expectOk } from '../src/assertions';
import { addDays, day, testNow } from '../src/dates';
import { expectedPrice } from '../src/pricing';
import type { Booking } from '../src/seed';
import { bookingBody, UNKNOWN_ID, type TestData } from '../src/testData';

test.describe('Booking creation and boundaries (BOOK)', () => {
  test('BOOK-001 Create a booking', smoke, async ({ api, tokens, seed, data }) => {
    const room = await data.createRoom();
    const body = bookingBody(room.id);
    const res = await api.post('/bookings', { token: tokens.g1, body });
    expectOk(res, 201, 'booking');
    expect(res.headers['location']).toBe(`/bookings/${res.body.id}`);
    expect(res.body).toMatchObject({
      roomId: room.id, userId: seed.g1.id, checkIn: body.checkIn, checkOut: body.checkOut,
      guests: 1, status: 'CONFIRMED', cancelledAt: null,
    });
    expect(res.body.paymentId).not.toBeNull();
    expect(res.body.totalPrice).toBeGreaterThan(0);

    const read = await api.get(res.headers['location'], { token: tokens.g1 });
    expectOk(read, 200, 'booking');
    expect(read.body).toEqual(res.body);
  });

  test('BOOK-002 Owner reads own booking', smoke, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    const booking = await data.createBooking(tokens.g1, room.id);
    const res = await api.get(`/bookings/${booking.id}`, { token: tokens.g1 });
    expectOk(res, 200, 'booking');
    expect(res.body).toEqual(booking);
  });

  test('BOOK-003 New booking appears in own list', regression, async ({ data }) => {
    const room = await data.createRoom();
    const user = await data.freshUser();
    const booking = await data.createBooking(user.token, room.id);
    const ids = (await data.allPages<Booking>('/bookings', user.token)).map((b) => b.id);
    expect(ids).toContain(booking.id);
  });

  /** Books OWN_ROOM as a fresh user, expects a 400 on `field`, and proves nothing was saved. */
  async function expectRejected(data: TestData, overrides: Record<string, unknown>, field: string) {
    const room = await data.createRoom();
    const user = await data.freshUser();
    const res = await data.book(user.token, room.id, overrides);
    expectError(res, 400, 'VALIDATION_ERROR', field);
    expect(await data.bookingsTotal(user.token)).toBe(0);
    return res;
  }

  test('BOOK-004 checkIn in the past', regression, async ({ data }) => {
    const res = await expectRejected(data, { checkIn: day(-1), checkOut: day(1) }, 'checkIn');
    expect(res.body.error.message).toBe('checkIn cannot be in the past');
  });

  test('BOOK-005 checkIn today is allowed', regression, async ({ tokens, data }) => {
    const room = await data.createRoom();
    await data.createBooking(tokens.g1, room.id, { checkIn: day(0), checkOut: day(1) });
  });

  test('BOOK-006 "Today" follows UTC, to the second', regression, async ({ api, tokens, data }) => {
    const x = day(50);
    const body = (roomId: string) => bookingBody(roomId, { checkIn: x, checkOut: addDays(x, 1) });

    // (a) last second of day X: checkIn X is "today" → allowed
    const roomA = await data.createRoom();
    const a = await api.post('/bookings', { token: tokens.g1, body: body(roomA.id), headers: testNow(`${x}T23:59:59Z`) });
    expectOk(a, 201, 'booking');

    // (b) first second of day X+1: checkIn X is "yesterday" → rejected
    const roomB = await data.createRoom();
    const b = await api.post('/bookings', { token: tokens.g1, body: body(roomB.id), headers: testNow(`${addDays(x, 1)}T00:00:00Z`) });
    expectError(b, 400, 'VALIDATION_ERROR', 'checkIn');
  });

  test('BOOK-007 Same-day checkout', regression, async ({ data }) => {
    const res = await expectRejected(data, { checkIn: day(30), checkOut: day(30) }, 'checkOut');
    expect(res.body.error.message).toBe('checkOut must be after checkIn');
  });

  test('BOOK-008 checkOut before checkIn', regression, async ({ data }) => {
    await expectRejected(data, { checkIn: day(30), checkOut: day(29) }, 'checkOut');
  });

  test('BOOK-009 30 nights is allowed', regression, async ({ tokens, data }) => {
    const room = await data.createRoom();
    const booking = await data.createBooking(tokens.g1, room.id, { checkIn: day(30), checkOut: day(60) });
    expect(booking.totalPrice).toBe(expectedPrice(100, day(30), day(60)));
  });

  test('BOOK-010 31 nights is rejected', regression, async ({ data }) => {
    const res = await expectRejected(data, { checkIn: day(30), checkOut: day(61) }, 'checkOut');
    expect(res.body.error.message).toBe('Maximum stay is 30 nights');
  });

  test('BOOK-011 checkIn 365 days ahead is allowed', regression, async ({ tokens, data }) => {
    const room = await data.createRoom();
    await data.createBooking(tokens.g1, room.id, { checkIn: day(365), checkOut: day(366) });
  });

  test('BOOK-012 checkIn 366 days ahead is rejected', regression, async ({ data }) => {
    await expectRejected(data, { checkIn: day(366), checkOut: day(367) }, 'checkIn');
  });

  test('BOOK-013 guests = 0', regression, async ({ data }) => {
    await expectRejected(data, { guests: 0 }, 'guests');
  });

  test('BOOK-014 guests = room capacity', regression, async ({ tokens, data }) => {
    const room = await data.createRoom(); // capacity 2
    const booking = await data.createBooking(tokens.g1, room.id, { guests: 2 });
    expect(booking.guests).toBe(2);
  });

  test('BOOK-015 guests = capacity + 1', regression, async ({ data }) => {
    await expectRejected(data, { guests: 3 }, 'guests');
  });

  test('BOOK-016 Negative guests', regression, async ({ data }) => {
    await expectRejected(data, { guests: -1 }, 'guests');
  });

  test('BOOK-017 Unknown room', regression, async ({ data }) => {
    const user = await data.freshUser();
    expectError(await data.book(user.token, UNKNOWN_ID), 404, 'NOT_FOUND');
    expect(await data.bookingsTotal(user.token)).toBe(0);
  });

  test('BOOK-018 roomId is not a UUID', regression, async ({ tokens, data }) => {
    expectError(await data.book(tokens.g1, 'abc'), 400, 'VALIDATION_ERROR', 'roomId');
  });

  test('BOOK-019 Inactive room cannot be booked', regression, async ({ seed, data }) => {
    const user = await data.freshUser();
    expectError(await data.book(user.token, seed.room('302').id), 409, 'ROOM_INACTIVE');
    expect(await data.bookingsTotal(user.token)).toBe(0);
  });

  test('BOOK-020 Get unknown booking', regression, async ({ api, tokens }) => {
    expectError(await api.get(`/bookings/${UNKNOWN_ID}`, { token: tokens.g1 }), 404, 'NOT_FOUND');
  });

  test('BOOK-021 Get booking with a non-UUID id', regression, async ({ api, tokens }) => {
    expectError(await api.get('/bookings/abc', { token: tokens.g1 }), 404, 'NOT_FOUND');
  });

  test('BOOK-022 Booking list pagination', regression, async ({ api, data }) => {
    const room = await data.createRoom();
    const user = await data.freshUser();
    for (const start of [30, 40, 50]) {
      await data.createBooking(user.token, room.id, { checkIn: day(start), checkOut: day(start + 1) });
    }
    const page1 = await api.get('/bookings?limit=2&page=1', { token: user.token });
    const page2 = await api.get('/bookings?limit=2&page=2', { token: user.token });
    expectOk(page1, 200, 'booking-list');
    expectOk(page2, 200, 'booking-list');
    expect(page1.body.total).toBe(3);
    expect(page1.body.items).toHaveLength(2);
    expect(page2.body.items).toHaveLength(1);
    const ids = [...page1.body.items, ...page2.body.items].map((b: Booking) => b.id);
    expect(new Set(ids).size).toBe(3);
  });
});
