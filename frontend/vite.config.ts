import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';

// Local development (`npm run dev`): the browser calls /api/..., and Vite forwards it to
// booking-api. The target is BASE_URL from the environment or the repo's env file
// (.env.test by default, ENV_FILE to change it). In Docker, nginx does the same job.
dotenv.config({ path: path.resolve(__dirname, '..', process.env.ENV_FILE ?? '.env.test') });

const apiTarget = process.env.BASE_URL;
if (!apiTarget) throw new Error('BASE_URL is not set (see .env.example)');

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.FRONTEND_PORT ?? 5173),
    proxy: {
      '/api': { target: apiTarget, rewrite: (p) => p.replace(/^\/api/, '') },
    },
  },
});
