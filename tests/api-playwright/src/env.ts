// Test configuration. Everything comes from environment variables.
// If they are not set, they are loaded from the repository's env file
// (default .env.test; choose another with ENV_FILE=.env.dev).
// Variables that are already set (e.g. in CI) always win.
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', process.env.ENV_FILE ?? '.env.test') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}

const credentials = (prefix: string) => ({
  email: required(`${prefix}_EMAIL`).toLowerCase(),
  password: required(`${prefix}_PASSWORD`),
});

export const env = {
  baseUrl: required('BASE_URL').replace(/\/+$/, ''),
  paymentUrl: required('PAYMENT_URL').replace(/\/+$/, ''),
  // Needed to build expired / forged tokens (AUTH-018, AUTH-022, AUTH-023).
  jwtSecret: required('JWT_SECRET'),
  checkinHourUtc: Number(process.env.CHECKIN_HOUR_UTC ?? 14),
  admin: credentials('SEED_ADMIN'),
  guest1: credentials('SEED_GUEST1'),
  guest2: credentials('SEED_GUEST2'),
};
