// Runs once before all tests: checks the system is up and loads the known dataset.
import { request } from '@playwright/test';
import { env } from './src/env';

export default async function globalSetup() {
  const context = await request.newContext();
  try {
    for (const [name, url] of [['booking-api', `${env.baseUrl}/health`], ['frontend', `${env.frontendUrl}/`]]) {
      const response = await context.get(url).catch(() => null);
      if (!response?.ok()) throw new Error(`${name} is not reachable at ${url}. Start the system: docker compose up --build`);
    }
    const seed = await context.post(`${env.baseUrl}/test/seed`);
    if (seed.status() !== 200) throw new Error(`POST /test/seed returned ${seed.status()}. Is APP_ENV=test?`);
  } finally {
    await context.dispose();
  }
}
