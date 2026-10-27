import { defineConfig, devices } from '@playwright/test';
import { RESULTS_JSON } from './lib/videos';

const APP_VIEWPORT = { width: 430, height: 900 };
/** Dashboard GUI tests (two pages, app + dashboard), run in their own project. */
const GUI_SPEC = /dashboard-gui\.spec\.ts$/;

// The suite shares one live demo stack (dashboard DB, client lanes, wander-api process),
// so it runs serially with a single worker. Every test restores what it changes.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: RESULTS_JSON }],
    ...(process.env.CI ? [['junit', { outputFile: 'test-results/junit.xml' }] as const] : []),
  ],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: process.env.APP_URL ?? 'http://127.0.0.1:8090',
    headless: true,
    viewport: APP_VIEWPORT,
    trace: 'retain-on-failure',
    video: process.env.E2E_VIDEO === 'on' ? 'on' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', testIgnore: GUI_SPEC, use: { ...devices['Desktop Chrome'], viewport: APP_VIEWPORT } },
    // Always recorded and traced, on every run: the side-by-side clips are a deliverable, not a failure aid.
    {
      name: 'gui',
      testMatch: GUI_SPEC,
      use: { ...devices['Desktop Chrome'], viewport: APP_VIEWPORT, video: { mode: 'on', size: APP_VIEWPORT }, trace: 'on' },
    },
  ],
});
