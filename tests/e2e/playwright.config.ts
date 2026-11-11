import { defineConfig, devices } from '@playwright/test';
import { env } from './src/env';

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: true, // every test creates its own room and guest
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results', // screenshots, videos and traces of failed tests

  use: {
    baseURL: env.frontendUrl,
    testIdAttribute: 'data-testid',
    // Failure artifacts (PROJECT_PLAN.md Phase 5): kept only when a test fails.
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
