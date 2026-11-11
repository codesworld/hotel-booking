import { test, expect, smoke, regression } from '../src/fixtures';
import { expectError, expectOk } from '../src/assertions';
import { env } from '../src/env';
import { expiredPayload, signToken, tamperToken, unsignedToken, validPayload } from '../src/jwt';
import { newRoom, newUser, UNKNOWN_ID } from '../src/testData';

test.describe('Authentication (AUTH)', () => {
  test('AUTH-001 Register a new guest', smoke, async ({ api }) => {
    const user = newUser();
    const res = await api.post('/auth/register', { body: user });
    expectOk(res, 201, 'user');
    expect(res.body.role).toBe('GUEST');
    expect(res.body.email).toBe(user.email);
    expect(res.text).not.toMatch(/password/i);
  });

  test('AUTH-002 Register stores the email in lowercase', regression, async ({ api }) => {
    const email = `Mixed.${Date.now()}${Math.floor(Math.random() * 1e6)}@Example.TEST`;
    const res = await api.post('/auth/register', { body: newUser({ email }) });
    expectOk(res, 201, 'user');
    expect(res.body.email).toBe(email.toLowerCase());
  });

  test('AUTH-003 Register with an existing email', regression, async ({ api, data }) => {
    const user = await data.freshUser();
    const res = await api.post('/auth/register', { body: newUser({ email: user.email, password: 'Another123!' }) });
    expectError(res, 409, 'EMAIL_TAKEN');
    // State: the original account and password are untouched
    const login = await api.post('/auth/login', { body: { email: user.email, password: user.password } });
    expectOk(login, 200, 'login-response');
  });

  test('AUTH-004 Register duplicate email with different case', regression, async ({ api, data }) => {
    const user = await data.freshUser();
    const res = await api.post('/auth/register', { body: newUser({ email: user.email.toUpperCase() }) });
    expectError(res, 409, 'EMAIL_TAKEN');
  });

  test('AUTH-005 Register cannot set role (mass assignment)', regression, async ({ api }) => {
    const user = newUser({ role: 'ADMIN' });
    const res = await api.post('/auth/register', { body: user });
    expectError(res, 400, 'VALIDATION_ERROR', 'role');
    expect(res.body.error.message).toBe('Unknown field: role');
    // State: no user was created
    const login = await api.post('/auth/login', { body: { email: user.email, password: user.password } });
    expectError(login, 401, 'INVALID_CREDENTIALS');
  });

  for (const email of ['plainaddress', 'a@', '@b.test', 'a b@c.test']) {
    test(`AUTH-006 Register with invalid email format [${email}]`, regression, async ({ api }) => {
      const res = await api.post('/auth/register', { body: newUser({ email }) });
      expectError(res, 400, 'VALIDATION_ERROR', 'email');
    });
  }

  for (const [length, status] of [[7, 400], [8, 201], [72, 201], [73, 400]]) {
    test(`AUTH-007 Password length boundaries [${length} chars → ${status}]`, regression, async ({ api }) => {
      const res = await api.post('/auth/register', { body: newUser({ password: 'p'.repeat(length) }) });
      if (status === 201) expectOk(res, 201, 'user');
      else expectError(res, 400, 'VALIDATION_ERROR', 'password');
    });
  }

  for (const fullName of ['', '   ']) {
    test(`AUTH-008 Register with an empty or whitespace-only full name [${JSON.stringify(fullName)}]`, regression, async ({ api }) => {
      const res = await api.post('/auth/register', { body: newUser({ fullName }) });
      expectError(res, 400, 'VALIDATION_ERROR', 'fullName');
    });
  }

  test('AUTH-009 Valid login', smoke, async ({ api, seed }) => {
    const res = await api.post('/auth/login', { body: env.guest1 });
    expectOk(res, 200, 'login-response');
    expect(res.body.tokenType).toBe('Bearer');
    expect(res.body.expiresIn).toBe(900);
    expect(res.body.user.email).toBe(env.guest1.email);
    expect(res.body.user.id).toBe(seed.g1.id);
    expect(res.body.user.role).toBe('GUEST');
  });

  test('AUTH-010 Login with wrong password', smoke, async ({ api }) => {
    const res = await api.post('/auth/login', { body: { email: env.guest1.email, password: 'WrongPass1!' } });
    expectError(res, 401, 'INVALID_CREDENTIALS');
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  test('AUTH-011 Login with unknown email gives the same message', regression, async ({ api }) => {
    const wrongPassword = await api.post('/auth/login', { body: { email: env.guest1.email, password: 'WrongPass1!' } });
    const unknownUser = await api.post('/auth/login', { body: { email: `nobody-${Date.now()}@example.test`, password: 'WrongPass1!' } });
    expectError(unknownUser, 401, 'INVALID_CREDENTIALS');
    expect(unknownUser.body).toEqual(wrongPassword.body);
  });

  test('AUTH-012 Login email is case-insensitive', regression, async ({ api }) => {
    const res = await api.post('/auth/login', { body: { email: env.guest1.email.toUpperCase(), password: env.guest1.password } });
    expectOk(res, 200, 'login-response');
    expect(res.body.user.email).toBe(env.guest1.email);
  });

  test('AUTH-013 Admin login returns ADMIN role', smoke, async ({ api }) => {
    const res = await api.post('/auth/login', { body: env.admin });
    expectOk(res, 200, 'login-response');
    expect(res.body.user.role).toBe('ADMIN');
  });

  test('AUTH-014 /auth/me with valid token', smoke, async ({ api, tokens, seed }) => {
    const res = await api.get('/auth/me', { token: tokens.g1 });
    expectOk(res, 200, 'user');
    expect(res.body).toMatchObject({ id: seed.g1.id, email: env.guest1.email, role: 'GUEST' });
  });

  test('AUTH-015 /auth/me without token', regression, async ({ api }) => {
    expectError(await api.get('/auth/me'), 401, 'AUTH_REQUIRED');
  });

  const malformedHeaders: [string, (token: string) => string][] = [
    ['Token scheme', (t) => `Token ${t}`],
    ['Bearer without token', () => 'Bearer'],
    ['token without scheme', (t) => t],
    ['extra part', (t) => `Bearer ${t} extra`],
    ['lowercase bearer', (t) => `bearer ${t}`],
  ];
  for (const [name, header] of malformedHeaders) {
    test(`AUTH-016 Malformed Authorization header [${name}]`, regression, async ({ api, tokens }) => {
      const res = await api.get('/auth/me', { headers: { Authorization: header(tokens.g1) } });
      expectError(res, 401, 'INVALID_TOKEN');
    });
  }

  test('AUTH-017 Invalid (garbage) token', regression, async ({ api }) => {
    expectError(await api.get('/auth/me', { token: 'not.a.jwt' }), 401, 'INVALID_TOKEN');
  });

  test('AUTH-018 Expired token', regression, async ({ api, seed }) => {
    const token = signToken(expiredPayload(seed.g1.id, 'GUEST'), env.jwtSecret);
    expectError(await api.get('/auth/me', { token }), 401, 'TOKEN_EXPIRED');
  });

  test('AUTH-019 Tampered token: role changed to ADMIN', regression, async ({ api, tokens, data }) => {
    const token = tamperToken(tokens.g1, { role: 'ADMIN' });
    expectError(await api.get('/auth/me', { token }), 401, 'INVALID_TOKEN');

    const room = newRoom();
    expectError(await api.post('/rooms', { token, body: room }), 401, 'INVALID_TOKEN');
    expect(await data.roomNumberExists(room.number)).toBe(false);
  });

  test('AUTH-020 Token signed with the wrong secret', regression, async ({ api, seed }) => {
    const token = signToken(validPayload(seed.g1.id, 'GUEST'), 'wrong-secret');
    expectError(await api.get('/auth/me', { token }), 401, 'INVALID_TOKEN');
  });

  test('AUTH-021 Unsigned token (alg: none)', regression, async ({ api, seed }) => {
    const token = unsignedToken(validPayload(seed.g1.id, 'GUEST'));
    expectError(await api.get('/auth/me', { token }), 401, 'INVALID_TOKEN');
  });

  test('AUTH-022 Correctly signed token for a non-existent user', regression, async ({ api }) => {
    const token = signToken(validPayload(UNKNOWN_ID, 'ADMIN'), env.jwtSecret);
    expectError(await api.get('/auth/me', { token }), 401, 'INVALID_TOKEN');
  });

  test('AUTH-023 Role is read from the database, not the token', regression, async ({ api, seed, data }) => {
    const token = signToken(validPayload(seed.g1.id, 'ADMIN'), env.jwtSecret); // valid signature, lying role
    const room = newRoom();
    expectError(await api.post('/rooms', { token, body: room }), 403, 'FORBIDDEN');
    expect(await data.roomNumberExists(room.number)).toBe(false);
  });
});
