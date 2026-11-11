import { test, expect, smoke, regression } from '../src/fixtures';
import { expectError, expectOk } from '../src/assertions';

test.describe('Payment integration (PAY)', () => {
  test('PAY-001 Approved payment confirms the booking', smoke, async ({ pay, tokens, data }) => {
    const room = await data.createRoom();
    const res = await data.book(tokens.g1, room.id, { cardToken: 'tok_success' });
    expectOk(res, 201, 'booking');

    const booking = await data.getBooking(res.body.id, tokens.g1);
    expect(booking.status).toBe('CONFIRMED');
    expect(booking.paymentId).not.toBeNull();

    const payment = await pay.get(`/payments/${booking.paymentId}`);
    expectOk(payment, 200, 'payment');
    expect(payment.body).toMatchObject({ status: 'APPROVED', amount: booking.totalPrice, bookingId: booking.id });
  });

  test('PAY-002 Declined payment', smoke, async ({ pay, tokens, data }) => {
    const room = await data.createRoom();
    const res = await data.book(tokens.g1, room.id, { cardToken: 'tok_decline' });
    expectError(res, 402, 'PAYMENT_DECLINED');
    const bookingId = res.body.error.details?.bookingId;
    expect(bookingId).toBeTruthy();

    const booking = await data.getBooking(bookingId, tokens.g1);
    expect(booking.status).toBe('PAYMENT_FAILED');
    expect(booking.paymentId).not.toBeNull();

    const payment = await pay.get(`/payments/${booking.paymentId}`);
    expectOk(payment, 200, 'payment');
    expect(payment.body.status).toBe('DECLINED');
  });

  test('PAY-003 Payment timeout', regression, async ({ tokens, data }) => {
    const room = await data.createRoom();
    const res = await data.book(tokens.g1, room.id, { cardToken: 'tok_slow' });
    expectError(res, 504, 'PAYMENT_TIMEOUT');
    // booking-api gives up after 3 s; it must not wait for the full 5 s of tok_slow
    expect(res.durationMs).toBeGreaterThanOrEqual(2900);
    expect(res.durationMs).toBeLessThan(4500);

    const booking = await data.getBooking(res.body.error.details.bookingId, tokens.g1);
    expect(booking.status).toBe('PAYMENT_FAILED');
    expect(booking.paymentId).toBeNull();
  });

  test('PAY-004 Payment service error', regression, async ({ tokens, data }) => {
    const room = await data.createRoom();
    const res = await data.book(tokens.g1, room.id, { cardToken: 'tok_error' });
    expectError(res, 502, 'PAYMENT_SERVICE_ERROR');

    const booking = await data.getBooking(res.body.error.details.bookingId, tokens.g1);
    expect(booking.status).toBe('PAYMENT_FAILED');
    expect(booking.paymentId).toBeNull();
  });

  test('PAY-005 Unknown card token', regression, async ({ data }) => {
    const room = await data.createRoom();
    const user = await data.freshUser();
    expectError(await data.book(user.token, room.id, { cardToken: 'tok_unknown' }), 400, 'VALIDATION_ERROR', 'cardToken');

    // State: nothing saved, and the room is still bookable for the same dates
    expect(await data.bookingsTotal(user.token)).toBe(0);
    await data.createBooking(user.token, room.id, { cardToken: 'tok_success' });
  });

  test('PAY-006 Empty card token', regression, async ({ data }) => {
    const room = await data.createRoom();
    const user = await data.freshUser();
    expectError(await data.book(user.token, room.id, { cardToken: '' }), 400, 'VALIDATION_ERROR', 'cardToken');
    expect(await data.bookingsTotal(user.token)).toBe(0);
  });

  // Manual case (tag "manual" in the catalog): needs `docker compose stop payment-service`.
  test.skip('PAY-007 payment-service down (manual: needs the container stopped)', () => {});
});

test.describe('payment-service API (PSVC)', () => {
  const paymentRequest = (cardToken: string, extra: Record<string, unknown> = {}) => ({
    bookingId: crypto.randomUUID(),
    amount: 123.45,
    cardToken,
    ...extra,
  });

  test('PSVC-001 Approve a payment', regression, async ({ pay }) => {
    const res = await pay.post('/payments', { body: paymentRequest('tok_success') });
    expectOk(res, 201, 'payment');
    expect(res.headers['location']).toBe(`/payments/${res.body.id}`);
    expect(res.body).toMatchObject({ status: 'APPROVED', amount: 123.45 });
  });

  test('PSVC-002 Decline a payment', regression, async ({ pay }) => {
    const res = await pay.post('/payments', { body: paymentRequest('tok_decline') });
    expectError(res, 402, 'PAYMENT_DECLINED');
    const payment = res.body.error.details.payment;
    expect(payment.status).toBe('DECLINED');

    const read = await pay.get(`/payments/${payment.id}`);
    expectOk(read, 200, 'payment');
    expect(read.body.status).toBe('DECLINED');
  });

  test('PSVC-003 Simulated provider failure', regression, async ({ pay }) => {
    const res = await pay.post('/payments', { body: paymentRequest('tok_error') });
    expectError(res, 500, 'INTERNAL_ERROR');
    expect(res.text).not.toMatch(/stack|node_modules/);
  });

  test('PSVC-004 Unknown card token', regression, async ({ pay }) => {
    expectError(await pay.post('/payments', { body: paymentRequest('tok_foo') }), 400, 'INVALID_CARD_TOKEN', 'cardToken');
  });

  test('PSVC-005 Slow token answers after 5 s', regression, async ({ pay }) => {
    test.setTimeout(20_000);
    const res = await pay.post('/payments', { body: paymentRequest('tok_slow') });
    expectOk(res, 201, 'payment');
    expect(res.durationMs).toBeGreaterThanOrEqual(4900);
  });

  const invalid: [string, Record<string, unknown>, string][] = [
    ['missing amount', { amount: undefined }, 'amount'],
    ['negative amount', { amount: -1 }, 'amount'],
    ['extra field', { foo: 'bar' }, 'foo'],
  ];
  for (const [name, change, field] of invalid) {
    test(`PSVC-006 Request validation [${name}]`, regression, async ({ pay }) => {
      const body = paymentRequest('tok_success', change);
      expectError(await pay.post('/payments', { body }), 400, 'VALIDATION_ERROR', field);
    });
  }

  test('PSVC-007 Get unknown payment', regression, async ({ pay }) => {
    expectError(await pay.get('/payments/00000000-0000-4000-8000-000000000000'), 404, 'NOT_FOUND');
  });
});
