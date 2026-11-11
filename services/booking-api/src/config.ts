// All configuration comes from environment variables. Nothing is hardcoded here.
// See .env.example in the repository root for the full list.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${name} must be a number, got "${raw}"`);
  }
  return value;
}

// DATABASE_URL can be given directly, or built from the POSTGRES_* / DB_* parts.
function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = required('POSTGRES_USER');
  const password = required('POSTGRES_PASSWORD');
  const host = required('DB_HOST');
  const port = required('DB_PORT');
  const db = required('POSTGRES_DB');
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${db}`;
}

export const config = {
  appEnv: process.env.APP_ENV ?? 'dev',
  port: optionalNumber('PORT', 3000),
  databaseUrl: databaseUrl(),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  bcryptRounds: optionalNumber('BCRYPT_ROUNDS', 10),
  checkinHourUtc: optionalNumber('CHECKIN_HOUR_UTC', 14),
  corsOrigin: process.env.CORS_ORIGIN ?? '',
  paymentServiceUrl: required('PAYMENT_SERVICE_URL').replace(/\/+$/, ''),
  paymentTimeoutMs: optionalNumber('PAYMENT_TIMEOUT_MS', 3000),
};

// Prisma reads DATABASE_URL from the environment.
process.env.DATABASE_URL = config.databaseUrl;

export const isTestEnv = () => config.appEnv === 'test';
