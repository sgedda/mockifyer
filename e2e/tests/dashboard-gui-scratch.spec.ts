import { expect } from '@playwright/test';
import { test, openAppFromLogin, PRESENTATION } from '../lib/gui';
import { ACTOR, documented } from '../lib/docs';
import { scratchStack } from '../lib/stack';
import { browserApp, FROM_SCRATCH_TEST, fromScratchSteps } from '../lib/gui-demo';
import { SCRATCH_DASHBOARD } from '../lib/env';

// The from-scratch test (lib/gui-demo.ts) against its own empty dashboard; it also runs on Android
// (tests/android-gui-scratch.spec.ts).
test.use({ dashboardUrl: SCRATCH_DASHBOARD });

const SCRATCH_TIMEOUT_MS = PRESENTATION ? 600_000 : 240_000;

test.describe('dashboard GUI from scratch', { tag: '@gui' }, () => {
  test.beforeAll(scratchStack.start);
  test.afterAll(scratchStack.stop);

  // Same order as the other GUI clips: the dashboard opens first, then the app signs in next to it.
  test.beforeEach(async ({ page, dash }) => {
    await expect(dash.page.getByRole('heading', { name: 'Total Files' })).toBeVisible();
    await openAppFromLogin(page);
  });

  test(FROM_SCRATCH_TEST.title, documented(FROM_SCRATCH_TEST.asserts, fromScratchSteps([
    [ACTOR.app, 'Login screen in a fresh context: type the demo user "wanderer" and the demo password, click Sign in, click the Discover tab'],
  ])), async ({ page, dash }) => {
    test.setTimeout(SCRATCH_TIMEOUT_MS);
    await FROM_SCRATCH_TEST.run({ dash, app: browserApp(page) });
  });
});
