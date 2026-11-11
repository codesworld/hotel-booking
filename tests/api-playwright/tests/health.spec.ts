import { test, expect, smoke, regression } from '../src/fixtures';
import { expectOk } from '../src/assertions';

test.describe('Health (HLTH)', () => {
  test('HLTH-001 booking-api health reports database up', smoke, async ({ api }) => {
    const res = await api.get('/health');
    expectOk(res, 200, 'health');
    expect(res.body).toEqual({ status: 'ok', service: 'booking-api', database: 'up' });
  });

  test('HLTH-002 payment-service health', smoke, async ({ pay }) => {
    const res = await pay.get('/health');
    expectOk(res, 200, 'health');
    expect(res.body).toEqual({ status: 'ok', service: 'payment-service' });
  });

  test('HLTH-003 OpenAPI spec lists every endpoint', regression, async ({ api }) => {
    const res = await api.get('/docs/openapi.json');
    expect(res.status).toBe(200);
    const paths = Object.keys(res.body.paths);
    for (const p of [
      '/auth/register', '/auth/login', '/auth/me',
      '/rooms', '/rooms/{id}', '/rooms/availability',
      '/bookings', '/bookings/{id}', '/bookings/{id}/cancel',
      '/health',
    ]) {
      expect(paths, `missing ${p}`).toContain(p);
    }
  });
});
