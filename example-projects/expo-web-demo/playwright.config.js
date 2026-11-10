import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  webServer: {
    command: 'npx http-server dist -p 3030',
    port: 3030,
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://localhost:3030',
    headless: true,
  },
});
