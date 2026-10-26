import { defineConfig, devices } from '@playwright/test';

// The suite shares one live demo stack (dashboard DB, client lanes, wander-api process),
// so it runs serially with a single worker. Every test restores what it changes.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]] : [['list'], ['html', { open: 'never' }]],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: process.env.APP_URL ?? 'http://127.0.0.1:8090',
    headless: true,
    viewport: { width: 430, height: 900 },
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 430, height: 900 } } }],
});
