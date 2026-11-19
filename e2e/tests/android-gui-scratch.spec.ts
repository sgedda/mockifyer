import { expect } from '@playwright/test';
import { androidTest as test } from '../lib/android';
import { ACTOR, documented } from '../lib/docs';
import { PRESENTATION } from '../lib/gui';
import { FROM_SCRATCH_TEST, fromScratchSteps } from '../lib/gui-demo';
import { scratchStack } from '../lib/stack';
import { SCRATCH_DASHBOARD } from '../lib/env';

// The from-scratch test (lib/gui-demo.ts) with the Android app (see android-gui.spec.ts).
test.use({ dashboardUrl: SCRATCH_DASHBOARD });

const SCRATCH_TIMEOUT_MS = PRESENTATION ? 1_200_000 : 600_000;

test.describe('dashboard GUI from scratch, Android app', { tag: ['@gui', '@android'] }, () => {
  test.beforeAll(scratchStack.start);
  test.afterAll(scratchStack.stop);

  test.beforeEach(async ({ dash, app }) => {
    await expect(dash.page.getByRole('heading', { name: 'Total Files' })).toBeVisible();
    await app.signIn();
  });

  test(FROM_SCRATCH_TEST.title, documented(FROM_SCRATCH_TEST.asserts, fromScratchSteps([
    [ACTOR.app, 'Maestro native/flows/launch.yaml: stop the app, clear its data and launch it: the login screen (the emulator screen recording starts here)'],
    [ACTOR.app, 'Maestro native/flows/sign-in.yaml: type the demo user "wanderer" and the demo password, tap Sign in, tap the Discover tab'],
  ])), async ({ dash, app }) => {
    test.setTimeout(SCRATCH_TIMEOUT_MS);
    await FROM_SCRATCH_TEST.run({ dash, app });
  });
});
