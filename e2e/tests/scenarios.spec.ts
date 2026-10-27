import { test, expect } from '@playwright/test';
import { dashboard, gatewayTemp } from '../lib/dashboard';
import { wander, waitForGateway } from '../lib/stack';
import { openDiscover, expectTemperatureAfterRefetch, expectTemperature } from '../lib/app';
import { BASE_SCENARIO, EXPECTED_TEMP, LANE } from '../lib/env';

// Lane switching only moves a service that is NOT pinned with MOCKIFYER_SCENARIO (body_override wins).
// beforeAll restarts wander-api following the lane; afterAll pins it back and resets lane + global.
test.describe('scenarios: client lane vs global', () => {
  test.beforeAll(async () => {
    wander.followLane();
    await waitForGateway();
  });
  test.afterAll(async () => {
    await dashboard.setLaneScenario(LANE, BASE_SCENARIO).catch(() => undefined);
    await dashboard.setGlobalScenario(BASE_SCENARIO);
    wander.pin(BASE_SCENARIO);
    await waitForGateway();
    await expect.poll(gatewayTemp, { timeout: 30_000 }).toBe(EXPECTED_TEMP[BASE_SCENARIO]);
  });
  test.afterEach(async () => {
    await dashboard.setLaneScenario(LANE, BASE_SCENARIO);
    await dashboard.setGlobalScenario(BASE_SCENARIO);
  });

  test('switching the lane moves the app: heatwave 44 -> rainy-weekend 11 -> base 99', async ({ page }) => {
    await openDiscover(page);
    for (const s of ['heatwave', 'rainy-weekend', BASE_SCENARIO]) {
      await dashboard.setLaneScenario(LANE, s);
      await expectTemperatureAfterRefetch(page, EXPECTED_TEMP[s]);
    }
  });

  test('the lane wins over the global scenario (resolutionSource lane_redis)', async ({ page }) => {
    await dashboard.setLaneScenario(LANE, BASE_SCENARIO);
    await dashboard.setGlobalScenario('heatwave');
    expect((await dashboard.scenarioConfig()).currentScenario).toBe('heatwave');
    await expect.poll(gatewayTemp, { timeout: 20_000 }).toBe(EXPECTED_TEMP[BASE_SCENARIO]);
    const lane = await dashboard.lane(LANE);
    expect(lane.lastSeenResolved.resolutionSource).toBe('lane_redis');
    expect(lane.lastSeenResolved.scenario).toBe(BASE_SCENARIO);
    await openDiscover(page);
    await expectTemperature(page, EXPECTED_TEMP[BASE_SCENARIO]);
  });

  test('a pinned service ignores its lane (resolutionSource body_override)', async () => {
    // Restarts wander-api twice (pin, then follow the lane again); each restart plus
    // waitForGateway took about 35 s in CI, which does not fit the suite's 45 s default.
    test.setTimeout(120_000);
    wander.pin(BASE_SCENARIO);
    try {
      await waitForGateway();
      await dashboard.setLaneScenario(LANE, 'heatwave');
      await expect.poll(gatewayTemp, { timeout: 20_000 }).toBe(EXPECTED_TEMP[BASE_SCENARIO]);
      expect((await dashboard.lane(LANE)).lastSeenResolved.resolutionSource).toBe('body_override');
    } finally {
      wander.followLane();
      await waitForGateway();
    }
  });

  // KNOWN GAP (by design today): the header Scenario picker only sets the global scenario
  // (POST /api/scenario-config/set). With strict lane mode (default) a client that has a clientId
  // but no lane gets unscoped live traffic instead of falling back to the global scenario.
  // This test asserts the behaviour a user would expect, so it is expected to fail.
  test('header picker (global scenario) moves a client without a lane', async ({ page }) => {
    test.fail(true, 'strict lane mode: no fallback to the global scenario for clients with a clientId');
    const lane = await dashboard.lane(LANE);
    await dashboard.deleteLane(LANE);
    try {
      await dashboard.setGlobalScenario('heatwave');
      await expect.poll(gatewayTemp, { timeout: 15_000 }).toBe(EXPECTED_TEMP.heatwave);
    } finally {
      await dashboard.setLaneScenario(LANE, lane?.scenario ?? BASE_SCENARIO);
      await dashboard.setGlobalScenario(BASE_SCENARIO);
    }
  });
});

test.describe('scenarios: create and clone', () => {
  // serial: the three steps share one temporary scenario; afterAll always deletes it
  test.describe.configure({ mode: 'serial' });
  const name = `e2e-tmp-${process.env.TEST_RUN_ID ?? Date.now()}`;
  test.afterAll(async () => {
    await dashboard.deleteScenario(name);
    await dashboard.setGlobalScenario(BASE_SCENARIO);
  });

  test('POST /api/scenario-config/create clones mocks, resets them to live API, and switches global', async () => {
    await dashboard.createScenario(name, BASE_SCENARIO);
    const cfg = await dashboard.scenarioConfig();
    expect(cfg.scenarios).toContain(name);
    expect(cfg.currentScenario).toBe(name); // create also makes it the global scenario
    await dashboard.setGlobalScenario(BASE_SCENARIO);

    const [base, copy] = await Promise.all([dashboard.listMocks(BASE_SCENARIO), dashboard.listMocks(name)]);
    expect(copy.length).toBe(base.length);
    const file = await dashboard.athensMock(name);
    const baseMock = await dashboard.getMock(await dashboard.athensMock(BASE_SCENARIO), BASE_SCENARIO);
    const m = await dashboard.getMock(file, name);
    expect(m.data.response.data.current.temperature_2m).toBe(baseMock.data.response.data.current.temperature_2m);
    // resetReplayModeForDerivedScenario -> passthrough ("live API")
    expect((await dashboard.mockMeta(file, name)).replayMode).toBe('passthrough');
  });

  test('"Use saved mock" sets replayMode stored on the copy only', async () => {
    const file = await dashboard.athensMock(name);
    expect((await dashboard.putMock(file, { replayMode: 'stored' }, name)).status).toBe(200);
    expect((await dashboard.mockMeta(file, name)).replayMode).toBe('stored');
    const baseFile = await dashboard.athensMock(BASE_SCENARIO);
    const baseMode = (await dashboard.mockMeta(baseFile, BASE_SCENARIO)).replayMode;
    expect(baseMode).toBe('stored'); // the base scenario's mock is untouched
  });

  test('deleting the scenario removes it', async () => {
    const r = await dashboard.deleteScenario(name);
    expect(r.status).toBe(200);
    expect((await dashboard.scenarioConfig()).scenarios).not.toContain(name);
  });
});
