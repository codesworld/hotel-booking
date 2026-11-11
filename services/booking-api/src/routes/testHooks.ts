// Test-only endpoints. app.ts mounts this router ONLY when APP_ENV=test;
// in every other environment these paths return 404.
import { Router } from 'express';
import { getNow } from '../utils/clock';
import { resetDatabase, seedDatabase } from '../testData/seed';

export const testHooksRouter = Router();

testHooksRouter.post('/reset', async (_req, res) => {
  await resetDatabase();
  res.json({ status: 'reset' });
});

// Wipes the database, then loads the known dataset. Returns the created ids.
testHooksRouter.post('/seed', async (req, res) => {
  const data = await seedDatabase(getNow(req));
  res.json(data);
});
