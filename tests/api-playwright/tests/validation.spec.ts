import { test, expect, regression } from '../src/fixtures';
import { expectError, expectOk } from '../src/assertions';
import { env } from '../src/env';
import { day } from '../src/dates';
import { bookingBody, newRoom, newUser, uniqueRoomNumber, UNKNOWN_ID } from '../src/testData';

test.describe('Request validation (VAL)', () => {
  for (const field of ['roomId', 'checkIn', 'checkOut', 'guests', 'cardToken']) {
    test(`VAL-001 POST /bookings: each required field missing [${field}]`, regression, async ({ api, data }) => {
      const room = await data.createRoom();
      const user = await data.freshUser();
      const body: Record<string, unknown> = bookingBody(room.id);
      delete body[field];

      const res = await api.post('/bookings', { token: user.token, body });
      expectError(res, 400, 'VALIDATION_ERROR', field);
      expect(res.body.error.message).toBe(`${field} is required`);
      expect(await data.bookingsTotal(user.token)).toBe(0);
    });
  }

  for (const field of ['email', 'password', 'fullName']) {
    test(`VAL-002 POST /auth/register: each required field missing [${field}]`, regression, async ({ api }) => {
      const body: Record<string, unknown> = newUser();
      delete body[field];
      expectError(await api.post('/auth/register', { body }), 400, 'VALIDATION_ERROR', field);
    });
  }

  for (const field of ['email', 'password']) {
    test(`VAL-003 POST /auth/login: each required field missing [${field}]`, regression, async ({ api }) => {
      const body: Record<string, unknown> = { ...env.guest1 };
      delete body[field];
      expectError(await api.post('/auth/login', { body }), 400, 'VALIDATION_ERROR', field);
    });
  }

  for (const field of ['number', 'type', 'capacity', 'pricePerNight']) {
    test(`VAL-004 POST /rooms: each required field missing [${field}]`, regression, async ({ api, tokens, data }) => {
      const body: Record<string, unknown> = newRoom();
      const number = body.number as string;
      delete body[field];
      expectError(await api.post('/rooms', { token: tokens.admin, body }), 400, 'VALIDATION_ERROR', field);
      expect(await data.roomNumberExists(number)).toBe(false);
    });
  }

  const bookingWrongTypes: [string, unknown][] = [
    ['guests', '1'], ['guests', 1.5], ['guests', true], ['roomId', 123],
    ['checkIn', 20261201], ['cardToken', null], ['checkOut', []],
  ];
  for (const [field, value] of bookingWrongTypes) {
    test(`VAL-005 POST /bookings: wrong types [${field}=${JSON.stringify(value)}]`, regression, async ({ api, data }) => {
      const room = await data.createRoom();
      const user = await data.freshUser();
      const res = await api.post('/bookings', { token: user.token, body: bookingBody(room.id, { [field]: value }) });
      expectError(res, 400, 'VALIDATION_ERROR', field);
      if (field === 'guests' && value === '1') expect(res.body.error.message).toBe('guests must be of type number');
      expect(await data.bookingsTotal(user.token)).toBe(0);
    });
  }

  const roomWrongTypes: [string, unknown][] = [
    ['capacity', '2'], ['capacity', 2.5], ['pricePerNight', '100'], ['type', 1], ['number', 101], ['isActive', 'false'],
  ];
  for (const [field, value] of roomWrongTypes) {
    test(`VAL-006 POST /rooms: wrong types [${field}=${JSON.stringify(value)}]`, regression, async ({ api, tokens, data }) => {
      const body = newRoom({ [field]: value });
      expectError(await api.post('/rooms', { token: tokens.admin, body }), 400, 'VALIDATION_ERROR', field);
      if (typeof body.number === 'string') expect(await data.roomNumberExists(body.number)).toBe(false);
    });
  }

  for (const checkIn of ['2026/12/01', '01-12-2026', '2026-12-1', '2026-13-01', '2027-02-30', '2026-12-01T00:00:00Z', '', 'tomorrow']) {
    test(`VAL-007 Invalid checkIn date formats [${JSON.stringify(checkIn)}]`, regression, async ({ api, tokens, data }) => {
      const room = await data.createRoom();
      const res = await api.post('/bookings', { token: tokens.g1, body: bookingBody(room.id, { checkIn }) });
      expectError(res, 400, 'VALIDATION_ERROR', 'checkIn');
    });
  }

  test('VAL-008 Invalid checkOut date format', regression, async ({ api, tokens, data }) => {
    const room = await data.createRoom();
    const res = await api.post('/bookings', { token: tokens.g1, body: bookingBody(room.id, { checkOut: '2026-12-32' }) });
    expectError(res, 400, 'VALIDATION_ERROR', 'checkOut');
  });

  for (const field of ['status', 'totalPrice', 'userId', 'paymentId']) {
    test(`VAL-009 Unknown fields are rejected (mass assignment) [${field}]`, regression, async ({ api, seed, data }) => {
      const room = await data.createRoom();
      const user = await data.freshUser();
      const extra: Record<string, unknown> = { status: 'CONFIRMED', totalPrice: 1, userId: seed.g2.id, paymentId: 'x' };
      const res = await api.post('/bookings', { token: user.token, body: { ...bookingBody(room.id), [field]: extra[field] } });
      expectError(res, 400, 'VALIDATION_ERROR', field);
      expect(res.body.error.message).toBe(`Unknown field: ${field}`);
      expect(await data.bookingsTotal(user.token)).toBe(0);
    });
  }

  test('VAL-010 Unknown field on room create', regression, async ({ api, tokens, data }) => {
    const body = newRoom({ id: UNKNOWN_ID });
    expectError(await api.post('/rooms', { token: tokens.admin, body }), 400, 'VALIDATION_ERROR', 'id');
    expect(await data.roomNumberExists(body.number as string)).toBe(false);
  });

  test('VAL-011 Malformed JSON body', regression, async ({ api, data }) => {
    const user = await data.freshUser();
    const res = await api.post('/bookings', {
      token: user.token, raw: '{"roomId": ', headers: { 'Content-Type': 'application/json' },
    });
    expectError(res, 400, 'INVALID_JSON');
    expect(await data.bookingsTotal(user.token)).toBe(0);
  });

  test('VAL-012 Malformed JSON on login', regression, async ({ api }) => {
    const res = await api.post('/auth/login', { raw: '{email:', headers: { 'Content-Type': 'application/json' } });
    expectError(res, 400, 'INVALID_JSON');
  });

  test('VAL-013 Wrong Content-Type', regression, async ({ api, data }) => {
    const room = await data.createRoom();
    const user = await data.freshUser();
    const res = await api.post('/bookings', {
      token: user.token, raw: JSON.stringify(bookingBody(room.id)), headers: { 'Content-Type': 'text/plain' },
    });
    expectError(res, 415, 'UNSUPPORTED_MEDIA_TYPE');
    expect(await data.bookingsTotal(user.token)).toBe(0);
  });

  test('VAL-014 Form-encoded body is rejected', regression, async ({ api }) => {
    const user = newUser();
    const raw = new URLSearchParams(user as Record<string, string>).toString();
    const res = await api.post('/auth/register', { raw, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    expectError(res, 415, 'UNSUPPORTED_MEDIA_TYPE');
    expectError(await api.post('/auth/login', { body: { email: user.email, password: user.password } }), 401, 'INVALID_CREDENTIALS');
  });

  test('VAL-015 Body is JSON but not an object', regression, async ({ api, tokens }) => {
    const json = { 'Content-Type': 'application/json' };
    const array = await api.post('/bookings', { token: tokens.g1, raw: '[]', headers: json });
    expectError(array, 400, 'VALIDATION_ERROR');
    expect(array.body.error.message).toBe('Request body must be a JSON object');

    const text = await api.post('/bookings', { token: tokens.g1, raw: '"text"', headers: json });
    expectError(text, 400, 'INVALID_JSON');
  });

  test('VAL-016 Empty body', regression, async ({ api, tokens }) => {
    const res = await api.post('/bookings', { token: tokens.g1 });
    expectError(res, 400, 'VALIDATION_ERROR');
    expect(['roomId', 'checkIn', 'checkOut', 'guests', 'cardToken']).toContain(res.body.error.field);
  });

  for (const [limit, status] of [[0, 400], [1, 200], [100, 200], [101, 400]]) {
    test(`VAL-017 Pagination limit boundaries [limit=${limit} → ${status}]`, regression, async ({ api }) => {
      const res = await api.get(`/rooms?limit=${limit}`);
      if (status === 400) return expectError(res, 400, 'VALIDATION_ERROR', 'limit');
      expectOk(res, 200, 'room-list');
      expect(res.body.limit).toBe(limit);
      expect(res.body.items.length).toBeLessThanOrEqual(limit);
    });
  }

  for (const page of ['0', '-1', 'abc', '1.5']) {
    test(`VAL-018 Invalid page values [page=${page}]`, regression, async ({ api }) => {
      expectError(await api.get(`/rooms?page=${page}`), 400, 'VALIDATION_ERROR', 'page');
    });
  }

  for (const [capacity, status] of [[0, 400], [1, 201], [6, 201], [7, 400]]) {
    test(`VAL-019 Room capacity boundaries [capacity=${capacity} → ${status}]`, regression, async ({ api, tokens }) => {
      const res = await api.post('/rooms', { token: tokens.admin, body: newRoom({ capacity }) });
      if (status === 201) expectOk(res, 201, 'room');
      else expectError(res, 400, 'VALIDATION_ERROR', 'capacity');
    });
  }

  for (const [price, status] of [[0, 400], [-1, 400], [0.01, 201], [10.999, 400]]) {
    test(`VAL-020 Room price boundaries [pricePerNight=${price} → ${status}]`, regression, async ({ api, tokens }) => {
      const res = await api.post('/rooms', { token: tokens.admin, body: newRoom({ pricePerNight: price }) });
      if (status === 201) expectOk(res, 201, 'room');
      else expectError(res, 400, 'VALIDATION_ERROR', 'pricePerNight');
    });
  }

  const roomNumbers: [string, () => string, number][] = [
    ['empty', () => '', 400],
    ['11 characters', () => 'ABCDEFGHIJK', 400],
    ['contains space', () => '1 01', 400],
    ['letters, digits and dash', () => `A1-${uniqueRoomNumber().slice(1, 6)}`, 201],
  ];
  for (const [name, number, status] of roomNumbers) {
    test(`VAL-021 Room number format [${name} → ${status}]`, regression, async ({ api, tokens }) => {
      const res = await api.post('/rooms', { token: tokens.admin, body: newRoom({ number: number() }) });
      if (status === 201) expectOk(res, 201, 'room');
      else expectError(res, 400, 'VALIDATION_ERROR', 'number');
    });
  }

  test('VAL-022 Room type must be a known value', regression, async ({ api, tokens }) => {
    const res = await api.post('/rooms', { token: tokens.admin, body: newRoom({ type: 'TRIPLE' }) });
    expectError(res, 400, 'VALIDATION_ERROR', 'type');
    expect(res.body.error.message).toContain('SINGLE, DOUBLE, SUITE');
  });

  const availabilityCases: [string, string, string][] = [
    ['no checkIn', `checkOut=${day(101)}`, 'checkIn'],
    ['no checkOut', `checkIn=${day(100)}`, 'checkOut'],
    ['guests=0', `checkIn=${day(100)}&checkOut=${day(101)}&guests=0`, 'guests'],
    ['guests=7', `checkIn=${day(100)}&checkOut=${day(101)}&guests=7`, 'guests'],
    ['type=TRIPLE', `checkIn=${day(100)}&checkOut=${day(101)}&type=TRIPLE`, 'type'],
    ['checkIn=2026/12/01', `checkIn=${encodeURIComponent('2026/12/01')}&checkOut=${day(101)}`, 'checkIn'],
  ];
  for (const [name, query, field] of availabilityCases) {
    test(`VAL-023 Availability query validation [${name}]`, regression, async ({ api }) => {
      expectError(await api.get(`/rooms/availability?${query}`), 400, 'VALIDATION_ERROR', field);
    });
  }
});
