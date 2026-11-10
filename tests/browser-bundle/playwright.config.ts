import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3100',
  },
  webServer: {
    command: 'npx http-server dist -p 3100',
    port: 3100,
    reuseExistingServer: true,
  },
});
