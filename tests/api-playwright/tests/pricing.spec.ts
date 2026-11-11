import { test, expect, regression } from '../src/fixtures';
import { expectOk } from '../src/assertions';
import { monday } from '../src/dates';
import { expectedPrice } from '../src/pricing';
import type { Room } from '../src/seed';

// OWN_ROOM costs 100.00 per night unless stated. monday(n) = MON+n; MON+4 is a Friday.
test.describe('Pricing (PRICE)', () => {
  const cases: [string, string, number, number, number, number][] = [
    // id, title, price, from (MON+n), to (MON+n), expected total
    ['PRICE-001', 'Weekday-only stay', 100, 0, 3, 300.0],
    ['PRICE-002', 'Stay including Friday and Saturday', 100, 3, 6, 340.0],
    ['PRICE-003', 'Friday night only', 100, 4, 5, 120.0],
    ['PRICE-004', 'Sunday night is not weekend', 100, 6, 7, 100.0],
    ['PRICE-005', 'Full week', 100, 0, 7, 740.0],
    ['PRICE-006', 'Rounding down', 33.33, 4, 6, 79.99],
    ['PRICE-007', 'Rounding up', 33.34, 4, 6, 80.02],
  ];

  for (const [id, title, price, from, to, total] of cases) {
    test(`${id} ${title}`, regression, async ({ tokens, data }) => {
      // sanity check of the test's own expectation against the independent oracle
      expect(expectedPrice(price, monday(from), monday(to))).toBe(total);

      const room = await data.createRoom({ pricePerNight: price });
      const booking = await data.createBooking(tokens.g1, room.id, { checkIn: monday(from), checkOut: monday(to) });
      expect(booking.totalPrice).toBe(total);
    });
  }

  test('PRICE-008 Availability price equals booking price', regression, async ({ tokens, data }) => {
    const room = await data.createRoom();
    const rooms = await data.allPages<Room & { totalPrice: number }>(
      `/rooms/availability?checkIn=${monday(2)}&checkOut=${monday(6)}`,
    );
    const offered = rooms.find((r) => r.id === room.id);
    expect(offered?.totalPrice).toBe(440.0);

    const booking = await data.createBooking(tokens.g1, room.id, { checkIn: monday(2), checkOut: monday(6) });
    expect(booking.totalPrice).toBe(offered!.totalPrice);
  });

  test('PRICE-009 Price change does not affect existing bookings', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    const booking = await data.createBooking(tokens.g1, room.id, { checkIn: monday(0), checkOut: monday(3) });
    expect(booking.totalPrice).toBe(300.0);

    expectOk(await api.patch(`/rooms/${room.id}`, { token: tokens.admin, body: { pricePerNight: 500 } }), 200, 'room');
    expect((await data.getBooking(booking.id)).totalPrice).toBe(300.0);
  });
});
