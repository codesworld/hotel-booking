import { test, expect, smoke, regression } from '../src/fixtures';
import { expectError, expectOk } from '../src/assertions';
import { day, testNow } from '../src/dates';
import type { Room } from '../src/seed';
import { newRoom, uniqueRoomNumber, UNKNOWN_ID } from '../src/testData';

test.describe('Rooms (ROOM)', () => {
  test('ROOM-001 Public room list shows only active rooms', smoke, async ({ data }) => {
    const rooms = await data.allPages<Room>('/rooms');
    expect(rooms.every((r) => r.isActive)).toBe(true);
    const numbers = rooms.map((r) => r.number);
    for (const n of ['101', '102', '201', '202', '301']) expect(numbers).toContain(n);
    expect(numbers).not.toContain('302');
  });

  test('ROOM-002 Filter by type', regression, async ({ api, data }) => {
    const first = await api.get('/rooms?type=SUITE');
    expectOk(first, 200, 'room-list');
    const rooms = await data.allPages<Room>('/rooms?type=SUITE');
    expect(rooms.every((r) => r.type === 'SUITE')).toBe(true);
    expect(rooms.map((r) => r.number)).toContain('301');
  });

  test('ROOM-003 Pagination', regression, async ({ api }) => {
    // type=SINGLE: no other test creates SINGLE rooms, so this list is stable (R101, R102).
    const page1 = await api.get('/rooms?type=SINGLE&limit=1&page=1');
    const page2 = await api.get('/rooms?type=SINGLE&limit=1&page=2');
    expectOk(page1, 200, 'room-list');
    expectOk(page2, 200, 'room-list');
    expect(page1.body).toMatchObject({ page: 1, limit: 1 });
    expect(page2.body).toMatchObject({ page: 2, limit: 1 });
    expect(page1.body.items).toHaveLength(1);
    expect(page2.body.items).toHaveLength(1);
    expect(page1.body.items[0].id).not.toBe(page2.body.items[0].id);
    expect(page1.body.total).toBe(page2.body.total);
  });

  test('ROOM-004 Get room by id', smoke, async ({ api, seed }) => {
    const res = await api.get(`/rooms/${seed.room('101').id}`);
    expectOk(res, 200, 'room');
    expect(res.body).toMatchObject({ number: '101', type: 'SINGLE', capacity: 1, pricePerNight: 80 });
  });

  test('ROOM-005 Get unknown room', regression, async ({ api }) => {
    expectError(await api.get(`/rooms/${UNKNOWN_ID}`), 404, 'NOT_FOUND');
  });

  test('ROOM-006 Get room with a non-UUID id', regression, async ({ api }) => {
    expectError(await api.get('/rooms/abc'), 404, 'NOT_FOUND');
  });

  test('ROOM-007 Inactive room is readable by id', regression, async ({ api, seed }) => {
    const res = await api.get(`/rooms/${seed.room('302').id}`);
    expectOk(res, 200, 'room');
    expect(res.body.isActive).toBe(false);
  });

  test('ROOM-008 Admin creates a room', smoke, async ({ api, tokens }) => {
    const body = newRoom();
    const res = await api.post('/rooms', { token: tokens.admin, body });
    expectOk(res, 201, 'room');
    expect(res.headers['location']).toBe(`/rooms/${res.body.id}`);
    expect(res.body).toMatchObject({ ...body, isActive: true });

    const read = await api.get(res.headers['location']);
    expectOk(read, 200, 'room');
    expect(read.body).toEqual(res.body);
  });

  test('ROOM-009 Admin creates an inactive room', regression, async ({ data }) => {
    const room = await data.createRoom({ isActive: false });
    expect(room.isActive).toBe(false);
    const publicIds = (await data.allPages<Room>('/rooms')).map((r) => r.id);
    expect(publicIds).not.toContain(room.id);
  });

  test('ROOM-010 Duplicate room number', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    const res = await api.post('/rooms', {
      token: tokens.admin,
      body: newRoom({ number: room.number, type: 'SUITE', capacity: 5, pricePerNight: 300 }),
    });
    expectError(res, 409, 'ROOM_NUMBER_TAKEN');
    expect(await data.getRoom(room.id)).toEqual(room);
  });

  test('ROOM-011 Replace room (PUT)', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    const replacement = { number: uniqueRoomNumber(), type: 'SUITE', capacity: 4, pricePerNight: 199.99 };
    const res = await api.put(`/rooms/${room.id}`, { token: tokens.admin, body: replacement });
    expectOk(res, 200, 'room');
    expect(res.body).toEqual({ id: room.id, ...replacement, isActive: true });
    expect(await data.getRoom(room.id)).toEqual(res.body);
  });

  test('ROOM-012 PUT rejects isActive', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    const res = await api.put(`/rooms/${room.id}`, { token: tokens.admin, body: { ...newRoom(), isActive: false } });
    expectError(res, 400, 'VALIDATION_ERROR', 'isActive');
    expect(await data.getRoom(room.id)).toEqual(room);
  });

  test('ROOM-013 PUT with a partial body', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    const res = await api.put(`/rooms/${room.id}`, { token: tokens.admin, body: { pricePerNight: 50 } });
    expectError(res, 400, 'VALIDATION_ERROR');
    expect((await data.getRoom(room.id)).pricePerNight).toBe(100);
  });

  test('ROOM-014 PUT to a number that already exists', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    const res = await api.put(`/rooms/${room.id}`, { token: tokens.admin, body: newRoom({ number: '101' }) });
    expectError(res, 409, 'ROOM_NUMBER_TAKEN');
    expect((await data.getRoom(room.id)).number).toBe(room.number);
  });

  test('ROOM-015 PUT unknown room', regression, async ({ api, tokens, data }) => {
    const body = newRoom();
    expectError(await api.put(`/rooms/${UNKNOWN_ID}`, { token: tokens.admin, body }), 404, 'NOT_FOUND');
    expect(await data.roomNumberExists(body.number as string)).toBe(false);
  });

  test('ROOM-016 PATCH a single field', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    const res = await api.patch(`/rooms/${room.id}`, { token: tokens.admin, body: { pricePerNight: 150 } });
    expectOk(res, 200, 'room');
    expect(res.body).toEqual({ ...room, pricePerNight: 150 });
  });

  test('ROOM-017 PATCH with an empty body', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    expectError(await api.patch(`/rooms/${room.id}`, { token: tokens.admin, body: {} }), 400, 'VALIDATION_ERROR');
    expect(await data.getRoom(room.id)).toEqual(room);
  });

  test('ROOM-018 PATCH unknown room', regression, async ({ api, tokens }) => {
    const res = await api.patch(`/rooms/${UNKNOWN_ID}`, { token: tokens.admin, body: { pricePerNight: 150 } });
    expectError(res, 404, 'NOT_FOUND');
  });

  test('ROOM-019 PATCH to a number that already exists', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    expectError(await api.patch(`/rooms/${room.id}`, { token: tokens.admin, body: { number: '101' } }), 409, 'ROOM_NUMBER_TAKEN');
    expect((await data.getRoom(room.id)).number).toBe(room.number);
  });

  test('ROOM-020 Deactivate a room without bookings', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    const res = await api.patch(`/rooms/${room.id}`, { token: tokens.admin, body: { isActive: false } });
    expectOk(res, 200, 'room');
    expect(res.body.isActive).toBe(false);
    expect((await data.allPages<Room>('/rooms')).map((r) => r.id)).not.toContain(room.id);
    expect(await data.availableRoomIds(`checkIn=${day(100)}&checkOut=${day(101)}`)).not.toContain(room.id);
  });

  test('ROOM-021 Cannot deactivate a room with future confirmed bookings', regression, async ({ api, tokens, seed, data }) => {
    const r301 = seed.room('301');
    const res = await api.patch(`/rooms/${r301.id}`, { token: tokens.admin, body: { isActive: false } });
    expectError(res, 409, 'ROOM_HAS_FUTURE_BOOKINGS');
    expect((await data.getRoom(r301.id)).isActive).toBe(true);
  });

  test('ROOM-022 Cancelled / failed bookings do not prevent deactivation', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    const user = await data.freshUser();
    expectError(await data.book(user.token, room.id, { cardToken: 'tok_decline' }), 402, 'PAYMENT_DECLINED');
    const booking = await data.createBooking(user.token, room.id, { checkIn: day(40), checkOut: day(42) });
    expectOk(await api.post(`/bookings/${booking.id}/cancel`, { token: user.token }), 200, 'booking');

    const res = await api.patch(`/rooms/${room.id}`, { token: tokens.admin, body: { isActive: false } });
    expectOk(res, 200, 'room');
    expect(res.body.isActive).toBe(false);
  });

  test('ROOM-023 Past confirmed bookings do not prevent deactivation', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    await data.createBooking(tokens.g1, room.id, { checkIn: day(5), checkOut: day(7) });
    const res = await api.patch(`/rooms/${room.id}`, {
      token: tokens.admin, body: { isActive: false }, headers: testNow(`${day(8)}T12:00:00Z`),
    });
    expectOk(res, 200, 'room');
    expect(res.body.isActive).toBe(false);
  });

  test('ROOM-024 Ongoing stay prevents deactivation', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    await data.createBooking(tokens.g1, room.id, { checkIn: day(5), checkOut: day(7) });
    const res = await api.patch(`/rooms/${room.id}`, {
      token: tokens.admin, body: { isActive: false }, headers: testNow(`${day(6)}T12:00:00Z`),
    });
    expectError(res, 409, 'ROOM_HAS_FUTURE_BOOKINGS');
    expect((await data.getRoom(room.id)).isActive).toBe(true);
  });

  test('ROOM-025 Reactivate a room', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom({ isActive: false });
    const res = await api.patch(`/rooms/${room.id}`, { token: tokens.admin, body: { isActive: true } });
    expectOk(res, 200, 'room');
    expect(res.body.isActive).toBe(true);
    expect((await data.allPages<Room>('/rooms')).map((r) => r.id)).toContain(room.id);
  });
});
