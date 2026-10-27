import { test, expect } from '@playwright/test';
import { dashboard, gatewayAtlantis } from '../lib/dashboard';
import { withMcp } from '../lib/mcp';
import { openDiscover } from '../lib/app';
import { BASE_SCENARIO, ATHENS_ENDPOINT_PREFIX, LANE } from '../lib/env';
import { documented } from '../lib/docs';

// The network log is written by the services (proxy runtime). Read-only apart from new log rows.
test.describe('trace: network log', () => {
  test('an app Discover load logs a mock-hit for Open-Meteo and an upstream hop for wander-api', documented('An app Discover load logs a mock-hit for Open-Meteo (lane wanderweird-demo) and a wander-api hop.'), async ({ page }) => {
    const since = new Date().toISOString();
    await openDiscover(page);
    await expect.poll(async () => {
      const ev = (await dashboard.networkEvents(BASE_SCENARIO)).filter((e) => e.timestamp >= since);
      return {
        mockHit: ev.some((e) => e.source === 'mock-hit' && e.url.startsWith(ATHENS_ENDPOINT_PREFIX) && e.clientId === LANE),
        wander: ev.some((e) => e.url.includes(':4203/discover')),
      };
    }, { timeout: 20_000 }).toEqual({ mockHit: true, wander: true });
  });

  test('the mock-hit hop links to its parent request (parentRequestId)', documented('The Open-Meteo mock-hit event has status 200, the base scenario and a parentRequestId.'), async () => {
    const since = new Date().toISOString();
    expect((await gatewayAtlantis()).status).toBe(200);
    let hit: any;
    await expect.poll(async () => {
      const ev = await dashboard.networkEvents(BASE_SCENARIO);
      hit = ev.find((e) => e.timestamp >= since && e.source === 'mock-hit' && e.url.startsWith(ATHENS_ENDPOINT_PREFIX));
      return !!hit;
    }, { timeout: 20_000 }).toBe(true);
    expect(hit.status).toBe(200);
    expect(hit.parentRequestId).toBeTruthy();
    expect(hit.scenario).toBe(BASE_SCENARIO);
  });

  test('MCP mockifyer_list_network_events returns the same traffic (no agent)', documented('MCP tool mockifyer_list_network_events lists the Open-Meteo mock-hit.'), async () => {
    await gatewayAtlantis();
    await withMcp(async (call) => {
      const out = await call('mockifyer_list_network_events', { scenario: BASE_SCENARIO, limit: 50 });
      expect(out).toContain('open-meteo');
      expect(out).toContain('mock-hit');
    });
  });
});
