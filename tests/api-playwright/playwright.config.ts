import { defineConfig } from '@playwright/test';
import './src/env'; // loads BASE_URL, PAYMENT_URL, credentials…

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: true, // tests are independent (catalog rule 1.2.1)
  workers: process.env.CI ? 2 : 4,
  retries: 0, // a flaky API test is a bug to fix, not to retry
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
});
