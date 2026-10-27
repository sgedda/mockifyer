import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { Dashboard, dashboard } from '../lib/dashboard';
import { withMcp } from '../lib/mcp';
import { ATHENS_ENDPOINT, EXPECTED_TEMP, MAIN_DASHBOARD, MAIN_MCP_CLI } from '../lib/env';

// Features merged to main after dashboard 1.5.92 (the version the demo stack used to install):
//   PR #476  statusOverride / responseDelayMs on mocks + MCP mockifyer_set_mock_behavior
//   PR #477  GET /api/network-events/explain-value + MCP mockifyer_explain_value
// They run against a separate dashboard built from the checkout (MAIN_DASHBOARD_URL, :3012 in CI,
// own data dir) and the MCP server from the same build (MAIN_MCP_CLI). The :3002 demo stack is
// only read. See README "Testing main".
const SCENARIO = 'heatwave';
const ATHENS = 'https://api.open-meteo.com/v1/forecast?latitude=37.9838';
const ATHENS_FIXTURE = join(__dirname, '../fixtures/athens-forecast.json');

/**
 * Puts the heatwave Athens forecast into the main dashboard via scenario import, so its data
 * dir needs no copy of the demo DB and no live Open-Meteo call. The offline proxy probe only
 * returns the request hash the import must be keyed by; it records nothing.
 */
async function seedMainDashboard(main: Dashboard): Promise<void> {
  const probe = await main.call('POST', '/proxy', { url: ATHENS_ENDPOINT, method: 'GET', scenario: SCENARIO, allowUpstream: false });
  expect(probe.json?.hash, 'request hash from the offline proxy probe').toBeTruthy();
  const data = JSON.parse(readFileSync(ATHENS_FIXTURE, 'utf8'));
  data.current.temperature_2m = EXPECTED_TEMP[SCENARIO];
  const timestamp = new Date().toISOString();
  const imported = await main.call('POST', '/scenario-config/import', {
    targetScenario: SCENARIO,
    applyDateConfig: false,
    applyProxyConfig: false,
    applyDomainPathRules: false,
    bundle: {
      formatVersion: 1,
      exportedAt: timestamp,
      sourceScenario: SCENARIO,
      mocks: [{
        relativePath: `redis/${probe.json.hash}.json`,
        data: {
          request: { method: 'GET', url: ATHENS_ENDPOINT, headers: {}, queryParams: {} },
          response: { status: 200, data, headers: {} },
          timestamp,
          scenario: SCENARIO,
        },
      }],
    },
  });
  expect(imported.status, `seed import: ${JSON.stringify(imported.json)}`).toBe(200);
}

test.describe('main dashboard build', () => {
  test.skip(!MAIN_DASHBOARD, 'set MAIN_DASHBOARD_URL to a dashboard built from main');
  const main = new Dashboard(MAIN_DASHBOARD);
  test.beforeAll(async () => { await seedMainDashboard(main); });

  test('MAIN_DASHBOARD_URL serves #476 (statusOverride) and #477 (explain-value)', async () => {
    const demoExplain = await dashboard.call('GET', '/network-events/explain-value');
    test.info().annotations.push({ type: 'demo-dashboard', description: `:3002 explain-value without params -> ${demoExplain.status} (404 = predates #477)` });

    const file = await main.athensMock(SCENARIO);
    expect((await main.putMock(file, { statusOverride: 503 }, SCENARIO)).status).toBe(200);
    expect((await main.putMock(file, { statusOverride: null }, SCENARIO)).status).toBe(200);
    expect((await main.call('GET', '/network-events/explain-value')).status).toBe(400);
  });
});

test.describe('main: status/delay overrides (#476)', () => {
  test.skip(!MAIN_DASHBOARD, 'set MAIN_DASHBOARD_URL to a dashboard built from main');
  const main = new Dashboard(MAIN_DASHBOARD);
  let file: string;
  test.beforeAll(async () => {
    await seedMainDashboard(main);
    file = await main.athensMock(SCENARIO);
  });
  test.afterEach(async () => { await main.putMock(file, { statusOverride: null, responseDelayMs: null }, SCENARIO); });

  test('PUT statusOverride + responseDelayMs is stored and cleared with null', async () => {
    expect((await main.putMock(file, { statusOverride: 503, responseDelayMs: 250 }, SCENARIO)).status).toBe(200);
    let m = (await main.getMock(file, SCENARIO)).data;
    expect([m.statusOverride, m.responseDelayMs]).toEqual([503, 250]);
    await main.putMock(file, { statusOverride: null, responseDelayMs: null }, SCENARIO);
    m = (await main.getMock(file, SCENARIO)).data;
    expect(m.statusOverride).toBeUndefined();
    expect(m.responseDelayMs).toBeUndefined();
  });

  test('invalid values are rejected with 400', async () => {
    expect((await main.putMock(file, { statusOverride: 700 }, SCENARIO)).status).toBe(400);
    expect((await main.putMock(file, { responseDelayMs: -5 }, SCENARIO)).status).toBe(400);
  });

  test('MCP mockifyer_set_mock_behavior sets and clears the override (no agent)', async () => {
    test.skip(!MAIN_MCP_CLI, 'set MAIN_MCP_CLI to packages/mockifyer-mcp/dist/cli.js built from main');
    await withMcp(async (call, tools) => {
      expect(tools).toContain('mockifyer_set_mock_behavior');
      await call('mockifyer_set_mock_behavior', { filename: file, scenario: SCENARIO, statusOverride: 429, responseDelayMs: 100 });
      const m = (await main.getMock(file, SCENARIO)).data;
      expect([m.statusOverride, m.responseDelayMs]).toEqual([429, 100]);
      await call('mockifyer_set_mock_behavior', { filename: file, scenario: SCENARIO, statusOverride: null, responseDelayMs: null });
      expect((await main.getMock(file, SCENARIO)).data.statusOverride).toBeUndefined();
    }, { cli: MAIN_MCP_CLI, dashboardUrl: MAIN_DASHBOARD });
  });

  // KNOWN GAP: the dashboard proxy route (POST /api/proxy, used by MOCKIFYER_RUNTIME=proxy as in
  // WanderWeird) returns the statusOverride but does not apply responseDelayMs.
  test('proxy runtime returns the statusOverride and applies the delay', async () => {
    test.fail(true, 'POST /api/proxy ignores responseDelayMs');
    await main.putMock(file, { statusOverride: 503, responseDelayMs: 800 }, SCENARIO);
    const url = (await main.listMocks(SCENARIO)).find((f: any) => f.endpoint.startsWith(ATHENS)).endpoint;
    const t0 = Date.now();
    const r = await main.call('POST', '/proxy', { url, method: 'GET', scenario: SCENARIO, allowUpstream: false });
    const ms = Date.now() - t0;
    expect(r.json.response.status).toBe(503);
    expect(ms).toBeGreaterThanOrEqual(800);
  });
});

test.describe('main: explain-value (#477)', () => {
  test.skip(!MAIN_DASHBOARD, 'set MAIN_DASHBOARD_URL to a dashboard built from main');
  const main = new Dashboard(MAIN_DASHBOARD);
  let file: string;
  test.beforeAll(async () => {
    await seedMainDashboard(main);
    file = await main.athensMock(SCENARIO);
  });
  test.afterEach(async () => {
    await main.call('PATCH', `/mocks/${file}/field-overrides?scenario=${SCENARIO}`, { responseFieldOverrides: null });
  });

  const query = `/network-events/explain-value?scenario=${SCENARIO}&url=${encodeURIComponent(ATHENS)}&fieldPath=current.temperature_2m`;

  test('missing lookup params return 400', async () => {
    expect((await main.call('GET', '/network-events/explain-value')).status).toBe(400);
  });

  test('traces a value to its mock file and reports a field override', async () => {
    let r = await main.call('GET', query);
    expect(r.status).toBe(200);
    expect(r.json.origin.mockFile).toBe(file);
    await main.call('PATCH', `/mocks/${file}/field-overrides?scenario=${SCENARIO}`, {
      responseFieldOverrides: [{ path: 'current.temperature_2m', value: -999 }],
    });
    r = await main.call('GET', query);
    expect(JSON.stringify(r.json.modifications)).toContain('-999');
  });

  test('MCP mockifyer_explain_value answers the same question (no agent)', async () => {
    test.skip(!MAIN_MCP_CLI, 'set MAIN_MCP_CLI to packages/mockifyer-mcp/dist/cli.js built from main');
    await withMcp(async (call, tools) => {
      expect(tools).toContain('mockifyer_explain_value');
      const out = await call('mockifyer_explain_value', { scenario: SCENARIO, url: ATHENS, fieldPath: 'current.temperature_2m' });
      expect(out).toContain(file.replace('redis/', ''));
    }, { cli: MAIN_MCP_CLI, dashboardUrl: MAIN_DASHBOARD });
  });
});
