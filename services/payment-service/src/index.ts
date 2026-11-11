import { config } from './config';
import { createApp } from './app';

const server = createApp().listen(config.port, () => {
  console.log(`payment-service listening on port ${config.port}`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
