// Playwright fixtures: every test gets these ready-made objects.
//   api    → booking-api client         pay  → payment-service client
//   tokens → T(ADMIN), T(G1), T(G2)       seed → seeded users/rooms/bookings (read-only)
//   data   → creates the test's own rooms, users, bookings
import { test as base, expect } from '@playwright/test';
import { ApiClient } from './api';
import { env } from './env';
import { Seed } from './seed';
import { TestData, type Tokens } from './testData';

type TestFixtures = { api: ApiClient; pay: ApiClient; data: TestData };
type WorkerFixtures = { tokens: Tokens; seed: Seed };

export const test = base.extend<TestFixtures, WorkerFixtures>({
  api: async ({ request }, use) => {
    await use(new ApiClient(request, env.baseUrl));
  },
  pay: async ({ request }, use) => {
    await use(new ApiClient(request, env.paymentUrl));
  },
  data: async ({ api, tokens }, use) => {
    await use(new TestData(api, tokens));
  },

  // Logged in once per worker (tokens live 15 minutes, longer than a test run).
  tokens: [
    async ({ playwright }, use) => {
      const context = await playwright.request.newContext();
      const client = new ApiClient(context, env.baseUrl);
      const login = async ({ email, password }: { email: string; password: string }) => {
        const res = await client.post('/auth/login', { body: { email, password } });
        expect(res.status, `login ${email}: ${res.text}`).toBe(200);
        return res.body.accessToken as string;
      };
      await use({ admin: await login(env.admin), g1: await login(env.guest1), g2: await login(env.guest2) });
      await context.dispose();
    },
    { scope: 'worker' },
  ],

  seed: [
    async ({}, use) => {
      await use(new Seed());
    },
    { scope: 'worker' },
  ],
});

export { expect };

// Tags (catalog rule 1.2.7). Usage: test('AUTH-001 …', smoke, async …)
export const smoke = { tag: '@smoke' };
export const regression = { tag: '@regression' };
