import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'e2e.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm run stubs',
      port: 3003,
      timeout: 10000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run gateway',
      port: 3001,
      timeout: 10000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run frontend',
      port: 5174,
      timeout: 10000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dashboard',
      port: 3002,
      timeout: 10000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
