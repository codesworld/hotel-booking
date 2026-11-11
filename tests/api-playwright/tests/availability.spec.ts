import { test, expect, smoke, regression } from '../src/fixtures';
import { expectError, expectOk } from '../src/assertions';
import { day } from '../src/dates';
import type { Room } from '../src/seed';
import type { TestData } from '../src/testData';

/** OWN_ROOM with one CONFIRMED booking E = D+20 → D+25 (catalog section 2.6). */
async function roomWithBookingE(data: TestData) {
  const room = await data.createRoom();
  const owner = await data.freshUser();
  const e = await data.createBooking(owner.token, room.id, { checkIn: day(20), checkOut: day(25) });
  return { room, owner, e };
}

const search = (checkIn: number, checkOut: number, extra = '') => `checkIn=${day(checkIn)}&checkOut=${day(checkOut)}${extra}`;

test.describe('Availability and overlap (AVAIL)', () => {
  test('AVAIL-001 Search returns free rooms with stay price', smoke, async ({ api, data }) => {
    const first = await api.get(`/rooms/availability?${search(100, 103)}`);
    expectOk(first, 200, 'availability-list');

    const rooms = await data.allPages<Room & { nights: number; totalPrice: number }>(`/rooms/availability?${search(100, 103)}`);
    for (const room of rooms) {
      expect(room.isActive).toBe(true);
      expect(room.nights).toBe(3);
      expect(room.totalPrice).toBeGreaterThan(0);
    }
    expect(rooms.map((r) => r.number)).not.toContain('302');
  });

  test('AVAIL-002 Booked room is not returned for overlapping dates', regression, async ({ data }) => {
    const { room } = await roomWithBookingE(data);
    expect(await data.availableRoomIds(search(21, 23))).not.toContain(room.id);
  });

  test('AVAIL-003 Room free from the checkout day (back-to-back)', regression, async ({ data }) => {
    const { room } = await roomWithBookingE(data);
    expect(await data.availableRoomIds(search(25, 27))).toContain(room.id);
  });

  test('AVAIL-004 Room free until the check-in day', regression, async ({ data }) => {
    const { room } = await roomWithBookingE(data);
    expect(await data.availableRoomIds(search(18, 20))).toContain(room.id);
  });

  test('AVAIL-005 Guests filter excludes small rooms', regression, async ({ data }) => {
    const room = await data.createRoom(); // capacity 2
    const forThree = await data.allPages<Room>(`/rooms/availability?${search(100, 101, '&guests=3')}`);
    expect(forThree.map((r) => r.id)).not.toContain(room.id);
    expect(forThree.every((r) => r.capacity >= 3)).toBe(true);
    expect(await data.availableRoomIds(search(100, 101, '&guests=2'))).toContain(room.id);
  });

  test('AVAIL-006 Type filter', regression, async ({ data }) => {
    const rooms = await data.allPages<Room>(`/rooms/availability?${search(100, 101, '&type=SINGLE')}`);
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms.every((r) => r.type === 'SINGLE')).toBe(true);
  });

  test('AVAIL-007 Inactive rooms are never returned', regression, async ({ seed, data }) => {
    expect(await data.availableRoomIds(search(100, 101))).not.toContain(seed.room('302').id);
  });

  test('AVAIL-008 Seeded statuses: blocking vs non-blocking', regression, async ({ seed, data }) => {
    // SB3 PENDING_PAYMENT blocks R102
    expect(await data.availableRoomIds(search(40, 42))).not.toContain(seed.room('102').id);
    // SB2 CANCELLED does not block R202
    expect(await data.availableRoomIds(search(20, 22))).toContain(seed.room('202').id);
    // SB4 PAYMENT_FAILED does not block R101
    expect(await data.availableRoomIds(search(5, 7))).toContain(seed.room('101').id);
  });

  const dateRuleCases: [string, string, string][] = [
    ['checkIn in the past', search(-1, 2), 'checkIn'],
    ['same-day checkout', search(10, 10), 'checkOut'],
    ['31 nights', search(10, 41), 'checkOut'],
    ['checkIn 366 days ahead', search(366, 367), 'checkIn'],
  ];
  for (const [name, query, field] of dateRuleCases) {
    test(`AVAIL-009 Date rules apply to search [${name}]`, regression, async ({ api }) => {
      expectError(await api.get(`/rooms/availability?${query}`), 400, 'VALIDATION_ERROR', field);
    });
  }

  const overlaps: [string, string, number, number][] = [
    ['AVAIL-010', 'identical dates', 20, 25],
    ['AVAIL-011', 'partial at the start', 18, 21],
    ['AVAIL-012', 'partial at the end', 24, 27],
    ['AVAIL-013', 'new stay inside the existing one', 21, 23],
    ['AVAIL-014', 'new stay encloses the existing one', 19, 26],
  ];
  for (const [id, name, from, to] of overlaps) {
    test(`${id} Overlap: ${name}`, regression, async ({ data }) => {
      const { room, e } = await roomWithBookingE(data);
      const other = await data.freshUser();
      const res = await data.book(other.token, room.id, { checkIn: day(from), checkOut: day(to) });
      expectError(res, 409, 'ROOM_UNAVAILABLE');
      expect(await data.bookingsTotal(other.token)).toBe(0);
      expect((await data.getBooking(e.id)).status).toBe('CONFIRMED');
    });
  }

  test('AVAIL-015 Back-to-back after: check-in on the checkout day', regression, async ({ data }) => {
    const { room } = await roomWithBookingE(data);
    const other = await data.freshUser();
    const booking = await data.createBooking(other.token, room.id, { checkIn: day(25), checkOut: day(27) });
    expect(booking.status).toBe('CONFIRMED');
  });

  test('AVAIL-016 Back-to-back before: checkout on the check-in day', regression, async ({ data }) => {
    const { room } = await roomWithBookingE(data);
    const other = await data.freshUser();
    const booking = await data.createBooking(other.token, room.id, { checkIn: day(18), checkOut: day(20) });
    expect(booking.status).toBe('CONFIRMED');
  });

  test('AVAIL-017 Cancelled booking frees the room', regression, async ({ api, data }) => {
    const { room, owner, e } = await roomWithBookingE(data);
    expectOk(await api.post(`/bookings/${e.id}/cancel`, { token: owner.token }), 200, 'booking');
    const other = await data.freshUser();
    const booking = await data.createBooking(other.token, room.id, { checkIn: day(20), checkOut: day(25) });
    expect(booking.status).toBe('CONFIRMED');
  });

  test('AVAIL-018 Failed payment does not block the room', regression, async ({ data }) => {
    const room = await data.createRoom();
    const first = await data.freshUser();
    const declined = await data.book(first.token, room.id, { checkIn: day(20), checkOut: day(25), cardToken: 'tok_decline' });
    expectError(declined, 402, 'PAYMENT_DECLINED');
    expect((await data.getBooking(declined.body.error.details.bookingId)).status).toBe('PAYMENT_FAILED');

    const second = await data.freshUser();
    const booking = await data.createBooking(second.token, room.id, { checkIn: day(20), checkOut: day(25) });
    expect(booking.status).toBe('CONFIRMED');
  });

  test('AVAIL-019 Pending payment blocks the room', regression, async ({ seed, data }) => {
    const user = await data.freshUser();
    const res = await data.book(user.token, seed.room('102').id, { checkIn: day(40), checkOut: day(42) });
    expectError(res, 409, 'ROOM_UNAVAILABLE');
    expect(await data.bookingsTotal(user.token)).toBe(0);
  });

  test('AVAIL-020 Same dates in a different room are fine', regression, async ({ data }) => {
    await roomWithBookingE(data);
    const room2 = await data.createRoom();
    const other = await data.freshUser();
    await data.createBooking(other.token, room2.id, { checkIn: day(20), checkOut: day(25) });
  });
});
