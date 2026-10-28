import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { RESULTS_JSON } from './lib/videos';
import { REPO_ROOT, REPO_ROOT_PLACEHOLDER } from './lib/report';
import { androidOn } from './lib/env';

const APP_VIEWPORT = { width: 430, height: 900 };
/** Dashboard GUI tests (two pages, app + dashboard), run in their own project. */
const GUI_SPEC = /dashboard-gui(-[a-z]+)?\.spec\.ts$/;
/** The same GUI tests with the Android app (emulator + Maestro); project `android`, only with E2E_ANDROID=1. */
const ANDROID_SPEC = /android-gui(-[a-z]+)?\.spec\.ts$/;
/** Maestro runs (each a JVM start plus the flow) make Android GUI tests slower than the web ones. */
const ANDROID_TIMEOUT_MS = 600_000;
/** Env that changes what the suite runs against; recorded in the JSON report for the run docs. */
const RECORDED_ENV = [
  'CI', 'E2E_VIDEO', 'E2E_PRESENTATION', 'APP_URL', 'MOCKIFYER_DASHBOARD_URL', 'GATEWAY_URL', 'BASE_SCENARIO',
  'MOCKIFYER_CLIENT_ID', 'MAIN_DASHBOARD_URL', 'MAIN_MCP_CLI', 'E2E_ANDROID', 'METRO_PORT',
];
const recordedEnv = Object.fromEntries(
  RECORDED_ENV.flatMap((key) => {
    const value = process.env[key];
    return value === undefined ? [] : [[key, value.split(REPO_ROOT).join(REPO_ROOT_PLACEHOLDER)]];
  })
);

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
  metadata: { cwd: path.relative(REPO_ROOT, process.cwd()) || '.', env: recordedEnv },
  use: {
    baseURL: process.env.APP_URL ?? 'http://127.0.0.1:8090',
    headless: true,
    viewport: APP_VIEWPORT,
    trace: 'retain-on-failure',
    video: process.env.E2E_VIDEO === 'on' ? 'on' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', testIgnore: [GUI_SPEC, ANDROID_SPEC], use: { ...devices['Desktop Chrome'], viewport: APP_VIEWPORT } },
    // Always recorded and traced, on every run: the side-by-side clips are a deliverable, not a failure aid.
    {
      name: 'gui',
      testMatch: GUI_SPEC,
      use: { ...devices['Desktop Chrome'], viewport: APP_VIEWPORT, video: { mode: 'on', size: APP_VIEWPORT }, trace: 'on' },
    },
    // The app is on the emulator (recorded with screenrecord); the browser only runs the dashboard context.
    ...(androidOn()
      ? [{
          name: 'android',
          testMatch: ANDROID_SPEC,
          timeout: ANDROID_TIMEOUT_MS,
          use: { ...devices['Desktop Chrome'], video: 'off' as const, trace: 'on' as const },
        }]
      : []),
  ],
});
