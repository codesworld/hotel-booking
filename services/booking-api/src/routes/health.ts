import { Router } from 'express';
import { prisma } from '../db';

export const healthRouter = Router();

// 200 when the database answers, 503 when it does not (used by Docker health checks).
healthRouter.get('/', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', service: 'booking-api', database: 'up' });
  } catch {
    res.status(503).json({
      status: 'error',
      service: 'booking-api',
      database: 'down',
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Database is not reachable' },
    });
  }
});
