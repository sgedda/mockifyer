import { test, expect } from '@playwright/test';
import { Dashboard, dashboard } from '../lib/dashboard';
import { withMcp } from '../lib/mcp';
import { MAIN_DASHBOARD, MAIN_MCP_CLI } from '../lib/env';

// Features merged to main after the packages installed in the demo stack (dashboard 1.5.92):
//   PR #476  statusOverride / responseDelayMs on mocks + MCP mockifyer_set_mock_behavior
//   PR #477  GET /api/network-events/explain-value + MCP mockifyer_explain_value
// They run against a dashboard built from main (MAIN_DASHBOARD_URL, e.g. :3012 on a COPY of the
// demo DB) and the MCP server built from main (MAIN_MCP_CLI). See README "Testing main".
const SCENARIO = 'heatwave';
const ATHENS = 'https://api.open-meteo.com/v1/forecast?latitude=37.9838';

test.describe('demo stack packages', () => {
  test('installed dashboard predates #476/#477 (documents why main tests need MAIN_DASHBOARD_URL)', async () => {
    const file = await dashboard.athensMock(SCENARIO);
    const put = await dashboard.putMock(file, { statusOverride: 503 }, SCENARIO);
    const explain = await dashboard.call('GET', '/network-events/explain-value?path=/discover&fieldPath=a');
    test.info().annotations.push({ type: 'demo-dashboard', description: `statusOverride PUT -> ${put.status}, explain-value -> ${explain.status}` });
    if (put.status === 200) await dashboard.putMock(file, { statusOverride: null }, SCENARIO); // newer package: undo
    test.skip(put.status === 200, 'demo stack already runs a dashboard with #476');
    expect(put.status).toBe(400);
    expect(explain.status).toBe(404);
  });
});

test.describe('main: status/delay overrides (#476)', () => {
  test.skip(!MAIN_DASHBOARD, 'set MAIN_DASHBOARD_URL to a dashboard built from main');
  const main = new Dashboard(MAIN_DASHBOARD);
  let file: string;
  test.beforeAll(async () => { file = await main.athensMock(SCENARIO); });
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

  // KNOWN GAP on main: the overrides are applied by the in-process axios/fetch clients only.
  // The dashboard proxy route (POST /api/proxy, used by MOCKIFYER_RUNTIME=proxy as in WanderWeird)
  // still returns mock.response.status with no delay, so the demo stack cannot show a 503 yet.
  test('proxy runtime returns the statusOverride and applies the delay', async () => {
    test.fail(true, 'POST /api/proxy ignores statusOverride/responseDelayMs on main');
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
  test.beforeAll(async () => { file = await main.athensMock(SCENARIO); });
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
