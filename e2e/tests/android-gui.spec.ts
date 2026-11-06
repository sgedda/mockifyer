import { expect } from '@playwright/test';
import { androidTest as test, TEMPERATURE_TEXT } from '../lib/android';
import { ACTOR } from '../lib/docs';
import { PRESENTATION, SIMULATION } from '../lib/gui';
import { followLaneAndWait, pinToBaseAndWait } from '../lib/stack';
import {
  BASE_TEMP,
  DEMO_GUI_TESTS,
  demoGuiDoc,
  expectOpenMeteoHop,
  loadAthensMock,
  NAV,
  expectOtherMocksUnchanged,
  otherMocksSimulation,
  RESPONSE_DELAY_MS,
  restoreDemo,
  storedAthensMock,
  UPSTREAM_ERROR_STATUS,
  type AthensMock,
} from '../lib/gui-demo';
import { BASE_SCENARIO, WANDER_FALLBACK_TEMP } from '../lib/env';

// The dashboard GUI tests of dashboard-gui.spec.ts with the Android app: the dashboard side is the same
// Playwright code (desktop context, recorded), the app side runs Maestro flows (native/flows) on an emulator
// recorded with screenrecord; npm run artifacts puts the two side by side. Run with E2E_ANDROID=1
// --project=android (native/README.md). The app reaches the stack through the dashboard proxy
// (EXPO_PUBLIC_MOCKIFYER_BACKEND=redis on Metro), as the web app does, with the lane fixed at build time.
const SLOW_TEST_TIMEOUT_MS = PRESENTATION ? 1_200_000 : 600_000;

const { dashboardUi: UI, app: APP, dashboardApi: API } = ACTOR;

const gui = demoGuiDoc([
  [APP, 'Maestro native/flows/launch.yaml: stop the app, clear its data (no stored session) and launch it: the login screen. The emulator screen recording starts here'],
  [APP, `Maestro native/flows/sign-in.yaml: type the demo user "wanderer" and the demo password into the login form, tap Sign in, tap the Discover tab: the Atlantis Boardwalk card's Temperature tile shows ${BASE_TEMP}° (Open-Meteo mock, scenario ${BASE_SCENARIO})`],
]);

test.describe('dashboard GUI drives the Android app', { tag: ['@gui', '@android'] }, () => {
  let athens: AthensMock;

  test.beforeAll(async () => {
    athens = await loadAthensMock();
    await followLaneAndWait();
  });
  test.afterEach(() => restoreDemo(athens));
  test.afterAll(pinToBaseAndWait);

  // `app` needs `dash`: the dashboard start screen is open before the app launches to its login screen.
  test.beforeEach(async ({ dash, app }) => {
    await expect(dash.page.getByRole('heading', { name: 'Total Files' })).toBeVisible();
    await app.signIn(TEMPERATURE_TEXT.exactly(BASE_TEMP));
  });

  test(DEMO_GUI_TESTS.bodyEdit.title, gui(DEMO_GUI_TESTS.bodyEdit.asserts, DEMO_GUI_TESTS.bodyEdit.steps), ({ dash, app }) =>
    DEMO_GUI_TESTS.bodyEdit.run({ dash, app, athens }));

  test(DEMO_GUI_TESTS.fieldOverride.title, gui(DEMO_GUI_TESTS.fieldOverride.asserts, DEMO_GUI_TESTS.fieldOverride.steps), ({ dash, app }) =>
    DEMO_GUI_TESTS.fieldOverride.run({ dash, app, athens }));

  test('mock editor: a 503 status override makes wander-api fall back to its improvised weather', gui(
    `A status override set in the mock editor is served through the proxy: wander-api gets a ${UPSTREAM_ERROR_STATUS} from Open-Meteo and answers 200 with its fallback weather, so the app shows ${WANDER_FALLBACK_TEMP}° and no error text (the app has no error state for an upstream failure that wander-api absorbs).`,
    [
      NAV.athensMock,
      [UI, `Mock editor, Request tab, Response Simulation > Status Override = ${UPSTREAM_ERROR_STATUS} (saved on blur), toast: Status override set to ${UPSTREAM_ERROR_STATUS}`],
      [APP, `Refetch until the Temperature tile shows ${WANDER_FALLBACK_TEMP}° (wander-api fallback); the Discover error text (testID discover-error) is not shown`],
      [API, `Stored statusOverride is ${UPSTREAM_ERROR_STATUS}`],
    ],
  ), async ({ dash, app }) => {
    await dash.openAthensMock(athens.file);
    await dash.setResponseSimulation(SIMULATION.status, UPSTREAM_ERROR_STATUS);
    await app.shows(WANDER_FALLBACK_TEMP);
    expect((await storedAthensMock(athens)).statusOverride).toBe(UPSTREAM_ERROR_STATUS);
  });

  // Native has no browser timing for the app's request: every duration here is the hop Duration the
  // dashboard Network view shows for the app's own load.
  test('mock editor: response delay and status override on the Open-Meteo endpoint only', gui(
    `Per-endpoint Response Delay and Status Override on the Open-Meteo mock, timed on the dashboard Network view (the native app has no browser timing): the Open-Meteo hop of the app's load takes at least the delay and the app still shows its value, a 503 makes wander-api fall back (${WANDER_FALLBACK_TEMP}°), both combine, and clearing them brings back ${BASE_TEMP}° at normal speed; other endpoints keep their timing and status, and only this mock stores the settings.`,
    [
      NAV.athensMock,
      [UI, `Request tab > Response Simulation > Response Delay (ms) = ${RESPONSE_DELAY_MS} (saved on blur), toast: Response delay set to ${RESPONSE_DELAY_MS}ms`],
      [UI, `${NAV.network[1]}; Clear`],
      [APP, `Refetch Discover: the tile still shows ${BASE_TEMP}° (a refetch keeps the old card until the answer arrives)`],
      [UI, `Trace of that load (Paused, Collapse all, expand GET /api/discover -> GET /discover): Open-Meteo hop Mock, Status 200, Duration >= ${RESPONSE_DELAY_MS} ms; GET /countries/name/greece Upstream, Status 200, Duration < ${RESPONSE_DELAY_MS} ms`],
      [UI, `Back to the mock editor (same navigation): Status Override = ${UPSTREAM_ERROR_STATUS}, delay kept; ${NAV.network[1]}; Clear`],
      [APP, `Refetch until the tile shows ${WANDER_FALLBACK_TEMP}° (wander-api's fallback weather for any non-2xx answer)`],
      [UI, `Trace: Open-Meteo hop Status ${UPSTREAM_ERROR_STATUS}, Duration >= ${RESPONSE_DELAY_MS} ms; countries hop Status 200, Duration < ${RESPONSE_DELAY_MS} ms`],
      [API, `The Athens forecast mock of ${BASE_SCENARIO} stores statusOverride ${UPSTREAM_ERROR_STATUS} / responseDelayMs ${RESPONSE_DELAY_MS}; every other mock there, and the heatwave copy of the same endpoint, keeps the settings it had before the test`],
      [UI, `Back to the mock editor: Response Delay Clear, toast: Response delay cleared; ${NAV.network[1]}; Clear`],
      [APP, `Refetch Discover: still ${WANDER_FALLBACK_TEMP}° (status override alone)`],
      [UI, `Trace: Open-Meteo hop Status ${UPSTREAM_ERROR_STATUS}, Duration < ${RESPONSE_DELAY_MS} ms`],
      [UI, `Back to the mock editor: Status Override Clear, toast: Status override cleared; ${NAV.network[1]}; Clear`],
      [APP, `Refetch until ${BASE_TEMP}° (the stored value)`],
      [UI, `Trace: Open-Meteo hop Status 200, Duration < ${RESPONSE_DELAY_MS} ms`],
      [API, 'The mock stores neither override any more'],
    ],
  ), async ({ dash, app }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);
    /** Change one Response Simulation field of the Athens mock, then trace one app load showing `appValue`. */
    async function simulateAndTrace(field: (typeof SIMULATION)[keyof typeof SIMULATION], value: number | null, expected: {
      appValue: number;
      status: number;
      delayed: boolean;
    }) {
      await dash.openAthensMock(athens.file);
      await dash.setResponseSimulation(field, value);
      await dash.openNetworkForLane();
      await expectOpenMeteoHop(dash, () => app.shows(expected.appValue), expected);
    }
    const othersBefore = await otherMocksSimulation(athens);

    await simulateAndTrace(SIMULATION.delay, RESPONSE_DELAY_MS, { appValue: BASE_TEMP, status: 200, delayed: true });
    await simulateAndTrace(SIMULATION.status, UPSTREAM_ERROR_STATUS, { appValue: WANDER_FALLBACK_TEMP, status: UPSTREAM_ERROR_STATUS, delayed: true });

    // Stored on this one mock only: every other mock (and the heatwave copy of this endpoint) is unchanged.
    expect(await storedAthensMock(athens)).toMatchObject({ statusOverride: UPSTREAM_ERROR_STATUS, responseDelayMs: RESPONSE_DELAY_MS });
    await expectOtherMocksUnchanged(athens, othersBefore);

    await simulateAndTrace(SIMULATION.delay, null, { appValue: WANDER_FALLBACK_TEMP, status: UPSTREAM_ERROR_STATUS, delayed: false });
    await simulateAndTrace(SIMULATION.status, null, { appValue: BASE_TEMP, status: 200, delayed: false });
    const cleared = await storedAthensMock(athens);
    expect([cleared.statusOverride ?? null, cleared.responseDelayMs ?? null]).toEqual([null, null]);
  });

  test(DEMO_GUI_TESTS.headerPicker.title, gui(DEMO_GUI_TESTS.headerPicker.asserts, DEMO_GUI_TESTS.headerPicker.steps), ({ dash, app }) =>
    DEMO_GUI_TESTS.headerPicker.run({ dash, app, athens }));
});
