import { test, expect, regression } from '../src/fixtures';
import { expectError, expectOk } from '../src/assertions';
import { day, monday } from '../src/dates';
import { UNKNOWN_ID } from '../src/testData';

const quotePath = (roomId: string, checkIn: string, checkOut: string) =>
  `/rooms/${roomId}/quote?checkIn=${checkIn}&checkOut=${checkOut}`;

test.describe('Price quote (QUOTE)', () => {
  test('QUOTE-001 Quote lists the price of each night', regression, async ({ api, data }) => {
    const room = await data.createRoom(); // 100.00
    const res = await api.get(quotePath(room.id, monday(3), monday(6))); // no token: public
    expectOk(res, 200, 'quote');
    expect(res.body).toEqual({
      roomId: room.id,
      checkIn: monday(3),
      checkOut: monday(6),
      pricePerNight: 100,
      nights: [
        { date: monday(3), isWeekend: false, price: 100 }, // Thursday
        { date: monday(4), isWeekend: true, price: 120 }, // Friday
        { date: monday(5), isWeekend: true, price: 120 }, // Saturday
      ],
      totalPrice: 340,
    });
  });

  test('QUOTE-002 Nightly prices are unrounded; only the total is rounded, and it matches the booking', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom({ pricePerNight: 33.33 });
    const quote = await api.get(quotePath(room.id, monday(4), monday(6)));
    expectOk(quote, 200, 'quote');
    expect(quote.body.nights.map((n: { price: number }) => n.price)).toEqual([39.996, 39.996]);
    expect(quote.body.totalPrice).toBe(79.99);

    const booking = await data.createBooking(tokens.g1, room.id, { checkIn: monday(4), checkOut: monday(6) });
    expect(booking.totalPrice).toBe(quote.body.totalPrice);
  });

  const dateRuleCases: [string, string, string][] = [
    ['checkIn in the past', `checkIn=${day(-1)}&checkOut=${day(2)}`, 'checkIn'],
    ['same-day checkout', `checkIn=${day(10)}&checkOut=${day(10)}`, 'checkOut'],
    ['31 nights', `checkIn=${day(10)}&checkOut=${day(41)}`, 'checkOut'],
    ['checkIn 366 days ahead', `checkIn=${day(366)}&checkOut=${day(367)}`, 'checkIn'],
    ['bad date format', `checkIn=${encodeURIComponent('2026/12/01')}&checkOut=${day(41)}`, 'checkIn'],
    ['no checkOut', `checkIn=${day(10)}`, 'checkOut'],
  ];
  for (const [name, query, field] of dateRuleCases) {
    test(`QUOTE-003 Date rules apply to quotes [${name}]`, regression, async ({ api, data }) => {
      const room = await data.createRoom();
      expectError(await api.get(`/rooms/${room.id}/quote?${query}`), 400, 'VALIDATION_ERROR', field);
    });
  }

  test('QUOTE-004 Quote for an unknown room', regression, async ({ api }) => {
    for (const id of [UNKNOWN_ID, 'abc']) {
      expectError(await api.get(quotePath(id, day(100), day(101))), 404, 'NOT_FOUND');
    }
  });

  test('QUOTE-005 Quote for an inactive room', regression, async ({ api, seed }) => {
    expectError(await api.get(quotePath(seed.room('302').id, day(100), day(101))), 409, 'ROOM_INACTIVE');
  });

  test('QUOTE-006 A quote is not an availability check', regression, async ({ api, data }) => {
    const room = await data.createRoom();
    const owner = await data.freshUser();
    await data.createBooking(owner.token, room.id, { checkIn: day(20), checkOut: day(25) });

    const quote = await api.get(quotePath(room.id, day(20), day(25)));
    expectOk(quote, 200, 'quote');
    expect(quote.body.nights).toHaveLength(5);

    const other = await data.freshUser();
    expectError(await data.book(other.token, room.id, { checkIn: day(20), checkOut: day(25) }), 409, 'ROOM_UNAVAILABLE');
  });
});
