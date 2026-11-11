// Builds the Express application: middleware, routes, docs, error handling.
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { config, isTestEnv } from './config';
import { errorHandler, notFoundHandler, requireJsonBody } from './middleware/errors';
import { authRouter } from './routes/auth';
import { bookingsRouter } from './routes/bookings';
import { healthRouter } from './routes/health';
import { roomsRouter } from './routes/rooms';
import { testHooksRouter } from './routes/testHooks';

function loadOpenApiSpec() {
  const file = path.join(__dirname, '..', 'openapi.yaml');
  const spec = YAML.parse(fs.readFileSync(file, 'utf8'));
  if (!isTestEnv()) {
    // test endpoints do not exist outside APP_ENV=test, so do not document them
    for (const p of Object.keys(spec.paths)) {
      if (p.startsWith('/test/')) delete spec.paths[p];
    }
  }
  return spec;
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by'); // do not reveal the framework

  if (config.corsOrigin) {
    app.use(cors({ origin: config.corsOrigin.split(','), exposedHeaders: ['Location'] }));
  }

  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`);
    });
    next();
  });

  app.use(requireJsonBody);
  app.use(express.json({ limit: '100kb' }));

  // API documentation
  const spec = loadOpenApiSpec();
  app.get('/docs/openapi.json', (_req, res) => {
    res.json(spec);
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec, { swaggerOptions: { persistAuthorization: true } }));

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/rooms', roomsRouter);
  app.use('/bookings', bookingsRouter);
  if (isTestEnv()) {
    app.use('/test', testHooksRouter);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
