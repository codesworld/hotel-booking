import { config } from './config';
import { createApp } from './app';
import { prisma } from './db';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`booking-api listening on port ${config.port} (APP_ENV=${config.appEnv})`);
});

// Shut down cleanly when Docker stops the container.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  });
}
