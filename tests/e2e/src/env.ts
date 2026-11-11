// Configuration from environment variables, falling back to the repository's env file
// (.env.test by default; ENV_FILE to change it). Real environment variables win.
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', process.env.ENV_FILE ?? '.env.test') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}

export const env = {
  frontendUrl: required('FRONTEND_URL').replace(/\/+$/, ''),
  baseUrl: required('BASE_URL').replace(/\/+$/, ''),
  admin: { email: required('SEED_ADMIN_EMAIL').toLowerCase(), password: required('SEED_ADMIN_PASSWORD') },
};
