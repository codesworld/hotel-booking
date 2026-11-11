import { test, expect, regression } from '../src/fixtures';
import { expectError, expectOk, expectSchema } from '../src/assertions';
import { env } from '../src/env';
import { day } from '../src/dates';
import { bookingBody, newRoom, newUser, UNKNOWN_ID } from '../src/testData';

test.describe('Response validation (RESP)', () => {
  test('RESP-001 JSON Content-Type on success and error', regression, async ({ api }) => {
    for (const res of [
      await api.get('/rooms'),
      await api.get(`/rooms/${UNKNOWN_ID}`),
      await api.post('/auth/login', { body: {} }),
    ]) {
      expect(res.headers['content-type']).toMatch(/^application\/json/);
    }
  });

  test('RESP-002 Error format is consistent across status codes', regression, async ({ api, tokens, seed, data }) => {
    const room = await data.createRoom();
    const missingRoomId: Record<string, unknown> = bookingBody(room.id);
    delete missingRoomId.roomId;

    const errors = {
      400: await api.post('/bookings', { token: tokens.g1, body: missingRoomId }),
      401: await api.get('/auth/me'),
      403: await api.get(`/bookings/${seed.booking(1).id}`, { token: tokens.g2 }),
      404: await api.get(`/rooms/${UNKNOWN_ID}`),
      409: await api.patch(`/rooms/${seed.room('301').id}`, { token: tokens.admin, body: { isActive: false } }),
      415: await api.post('/bookings', { token: tokens.g1, raw: '{}', headers: { 'Content-Type': 'text/plain' } }),
      422: await api.post(`/bookings/${seed.booking(6).id}/cancel`, { token: tokens.g2 }),
    };
    for (const [status, res] of Object.entries(errors)) {
      expect(res.status, `expected ${status}: ${res.text}`).toBe(Number(status));
      expectSchema(res.body, 'error');
      expect(res.body.error.code).toMatch(/^[A-Z][A-Z_]*$/);
      expect(res.body.error.message.length).toBeGreaterThan(0);
    }
  });

  test('RESP-003 Unknown route returns JSON 404', regression, async ({ api, seed }) => {
    for (const res of [await api.get('/does-not-exist'), await api.delete(`/rooms/${seed.room('101').id}`)]) {
      expectError(res, 404, 'NOT_FOUND');
      expect(res.text).not.toMatch(/<html/i);
    }
  });

  test('RESP-004 No sensitive data in responses', regression, async ({ api, tokens }) => {
    const user = newUser();
    const responses = [
      await api.post('/auth/register', { body: user }),
      await api.post('/auth/login', { body: { email: user.email, password: user.password } }),
      await api.get('/auth/me', { token: tokens.g1 }),
      await api.get('/bookings?limit=100', { token: tokens.admin }),
    ];
    for (const res of responses) {
      expect(res.status).toBeLessThan(300);
      expect(res.text).not.toMatch(/password/i);
      expect(res.text).not.toMatch(/\$2[aby]\$/); // bcrypt hash prefix
    }
  });

  test('RESP-005 No framework or version headers', regression, async ({ api }) => {
    for (const res of [await api.get('/health'), await api.get('/does-not-exist')]) {
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['server'] ?? '').not.toMatch(/express|node|\d+\.\d+/i);
    }
  });

  test('RESP-006 No stack trace in errors', regression, async ({ api, tokens }) => {
    const res = await api.post('/bookings', {
      token: tokens.g1, raw: '{"roomId": ', headers: { 'Content-Type': 'application/json' },
    });
    expectError(res, 400, 'INVALID_JSON');
    expect(res.text).not.toMatch(/stack|node_modules|\bat \S+\.(js|ts):\d+/);
  });

  test('RESP-007 Response time under 500 ms', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    const timings = {
      'GET /rooms': await api.get('/rooms'),
      'GET /rooms/availability': await api.get(`/rooms/availability?checkIn=${day(100)}&checkOut=${day(103)}`),
      'POST /auth/login': await api.post('/auth/login', { body: env.guest1 }),
      'POST /bookings': await api.post('/bookings', { token: tokens.g1, body: bookingBody(room.id) }),
      'GET /bookings': await api.get('/bookings', { token: tokens.g1 }),
    };
    for (const [name, res] of Object.entries(timings)) {
      expect(res.status, `${name}: ${res.text}`).toBeLessThan(300);
      expect(res.durationMs, `${name} took ${res.durationMs} ms`).toBeLessThan(500);
    }
  });

  test('RESP-008 Payload too large', regression, async ({ api, data }) => {
    const user = await data.freshUser();
    const res = await api.post('/bookings', { token: user.token, body: { cardToken: 'x'.repeat(200_000) } });
    expectError(res, 413, 'PAYLOAD_TOO_LARGE');
    expect(await data.bookingsTotal(user.token)).toBe(0);
  });

  test('RESP-009 Location header on every 201', regression, async ({ api, tokens, data }) => {
    const created = await api.post('/rooms', { token: tokens.admin, body: newRoom() });
    expectOk(created, 201, 'room');
    expect(created.headers['location']).toBe(`/rooms/${created.body.id}`);
    expectOk(await api.get(created.headers['location']), 200, 'room');

    const booked = await api.post('/bookings', { token: tokens.g1, body: bookingBody(created.body.id) });
    expectOk(booked, 201, 'booking');
    expect(booked.headers['location']).toBe(`/bookings/${booked.body.id}`);
    expectOk(await api.get(booked.headers['location'], { token: tokens.g1 }), 200, 'booking');
  });
});
