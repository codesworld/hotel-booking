// Runs ONCE before all tests: checks the API is up and loads the known dataset.
// The seed response (ids of users, rooms, bookings) is saved to .seed.json for the tests.
import fs from 'node:fs';
import { request } from '@playwright/test';
import { env } from './src/env';
import { SEED_FILE } from './src/seed';

export default async function globalSetup() {
  const context = await request.newContext();
  try {
    const health = await context.get(`${env.baseUrl}/health`).catch(() => null);
    if (!health || health.status() !== 200) {
      throw new Error(`booking-api is not healthy at ${env.baseUrl}. Start it with: docker compose up --build`);
    }
    const seed = await context.post(`${env.baseUrl}/test/seed`);
    if (seed.status() !== 200) {
      throw new Error(`POST /test/seed returned ${seed.status()}. Is APP_ENV=test? Body: ${await seed.text()}`);
    }
    fs.writeFileSync(SEED_FILE, await seed.text());
  } finally {
    await context.dispose();
  }
}
