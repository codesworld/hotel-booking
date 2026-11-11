import { test, expect, regression } from '../src/fixtures';
import { expectError, expectOk } from '../src/assertions';
import type { Booking, Room } from '../src/seed';
import { bookingBody, newRoom } from '../src/testData';

test.describe('Authorization (AUTHZ)', () => {
  test('AUTHZ-001 Guest cannot create a room', regression, async ({ api, tokens, data }) => {
    const room = newRoom();
    expectError(await api.post('/rooms', { token: tokens.g1, body: room }), 403, 'FORBIDDEN');
    expect(await data.roomNumberExists(room.number)).toBe(false);
  });

  test('AUTHZ-002 Guest cannot replace a room', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    const res = await api.put(`/rooms/${room.id}`, { token: tokens.g1, body: newRoom({ pricePerNight: 1 }) });
    expectError(res, 403, 'FORBIDDEN');
    expect(await data.getRoom(room.id)).toEqual(room);
  });

  test('AUTHZ-003 Guest cannot patch/deactivate a room', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    const res = await api.patch(`/rooms/${room.id}`, { token: tokens.g1, body: { isActive: false } });
    expectError(res, 403, 'FORBIDDEN');
    expect((await data.getRoom(room.id)).isActive).toBe(true);
  });

  for (const method of ['POST', 'PUT', 'PATCH'] as const) {
    test(`AUTHZ-004 Room write endpoints require a token [${method}]`, regression, async ({ api, data }) => {
      const room = await data.createRoom();
      const body = method === 'PATCH' ? { isActive: false } : newRoom();
      const path = method === 'POST' ? '/rooms' : `/rooms/${room.id}`;
      expectError(await api.send(method, path, { body }), 401, 'AUTH_REQUIRED');

      expect(await data.getRoom(room.id)).toEqual(room);
      if (method === 'POST') expect(await data.roomNumberExists((body as Room).number)).toBe(false);
    });
  }

  const bookingEndpoints: [string, string, (sb1: Booking) => string][] = [
    ['POST /bookings', 'POST', () => '/bookings'],
    ['GET /bookings', 'GET', () => '/bookings'],
    ['GET /bookings/{id}', 'GET', (sb1) => `/bookings/${sb1.id}`],
    ['POST /bookings/{id}/cancel', 'POST', (sb1) => `/bookings/${sb1.id}/cancel`],
  ];
  for (const [name, method, path] of bookingEndpoints) {
    test(`AUTHZ-005 Booking endpoints require a token [${name}]`, regression, async ({ api, seed, data }) => {
      const sb1 = seed.booking(1);
      const body = name === 'POST /bookings' ? bookingBody(seed.room('202').id) : undefined;
      expectError(await api.send(method, path(sb1), { body }), 401, 'AUTH_REQUIRED');
      expect((await data.getBooking(sb1.id)).status).toBe('CONFIRMED');
    });
  }

  test('AUTHZ-006 Guest sees only own bookings', regression, async ({ tokens, seed, data }) => {
    const bookings = await data.allPages<Booking>('/bookings', tokens.g2);
    expect(bookings.every((b) => b.userId === seed.g2.id)).toBe(true);
    const ids = bookings.map((b) => b.id);
    for (const n of [4, 5, 6] as const) expect(ids).toContain(seed.booking(n).id);
    for (const n of [1, 2, 3] as const) expect(ids).not.toContain(seed.booking(n).id);
  });

  test('AUTHZ-007 Admin sees all bookings', regression, async ({ tokens, seed, data }) => {
    const ids = (await data.allPages<Booking>('/bookings', tokens.admin)).map((b) => b.id);
    for (const n of [1, 2, 3, 4, 5, 6] as const) expect(ids).toContain(seed.booking(n).id);
  });

  test("AUTHZ-008 Guest cannot read another guest's booking", regression, async ({ api, tokens, seed }) => {
    expectError(await api.get(`/bookings/${seed.booking(1).id}`, { token: tokens.g2 }), 403, 'FORBIDDEN');
  });

  test("AUTHZ-009 Guest cannot cancel another guest's booking", regression, async ({ api, tokens, seed, data }) => {
    const sb1 = seed.booking(1);
    expectError(await api.post(`/bookings/${sb1.id}/cancel`, { token: tokens.g2 }), 403, 'FORBIDDEN');
    const after = await data.getBooking(sb1.id);
    expect(after.status).toBe('CONFIRMED');
    expect(after.cancelledAt).toBeNull();
  });

  test('AUTHZ-010 Admin can read any booking', regression, async ({ api, tokens, seed }) => {
    const res = await api.get(`/bookings/${seed.booking(1).id}`, { token: tokens.admin });
    expectOk(res, 200, 'booking');
    expect(res.body.userId).toBe(seed.g1.id);
  });

  test('AUTHZ-011 includeInactive is ignored for guests and anonymous users', regression, async ({ tokens, seed, data }) => {
    for (const token of [tokens.g1, undefined]) {
      const numbers = (await data.allPages<Room>('/rooms?includeInactive=true', token)).map((r) => r.number);
      expect(numbers).not.toContain(seed.room('302').number);
    }
  });

  test('AUTHZ-012 Admin can list inactive rooms', regression, async ({ tokens, data }) => {
    const rooms = await data.allPages<Room>('/rooms?includeInactive=true', tokens.admin);
    expect(rooms.find((r) => r.number === '302')?.isActive).toBe(false);
  });

  test('AUTHZ-013 New guest cannot see seeded bookings', regression, async ({ api, data }) => {
    const user = await data.freshUser();
    const res = await api.get('/bookings', { token: user.token });
    expectOk(res, 200, 'booking-list');
    expect(res.body.total).toBe(0);
    expect(res.body.items).toEqual([]);
  });
});
