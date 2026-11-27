import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['e2e.spec.js', 'integration.spec.js'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node gateway.js',
      url: 'http://localhost:3001/api/trip/London',
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run frontend',
      url: 'http://localhost:5173',
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx mockifyer-dashboard --path ./mock-data --port 3002',
      url: 'http://localhost:3002',
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
