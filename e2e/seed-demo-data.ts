#!/usr/bin/env node
/**
 * Seed demo scenarios and client lane for the E2E suite.
 * Creates guide-demo-2 (99°), heatwave (44°), rainy-weekend (11°) scenarios
 * with an Open-Meteo Athens forecast mock, plus the wanderweird-demo client lane.
 * Idempotent: can run multiple times safely.
 * 
 * Uses a committed fixture (fixtures/athens-forecast.json) for deterministic seeding.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { DASHBOARD, ATHENS_ENDPOINT_PREFIX, EXPECTED_TEMP, LANE, BASE_SCENARIO } from './lib/env';

const ATHENS_ENDPOINT = `${ATHENS_ENDPOINT_PREFIX}&longitude=23.7275&current=temperature_2m,relative_humidity_2m,wind_speed_10m&hourly=temperature_2m&timezone=Europe%2FAthens`;

// Load committed fixture for deterministic seeding
const ATHENS_FIXTURE = JSON.parse(readFileSync(join(__dirname, 'fixtures/athens-forecast.json'), 'utf8'));

async function call(method: string, path: string, body?: any): Promise<{ status: number; json: any }> {
  const res = await fetch(DASHBOARD + '/api' + path, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = text;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json };
}

async function ok(method: string, path: string, body?: any): Promise<any> {
  const r = await call(method, path, body);
  if (r.status >= 400) throw new Error(`${method} ${path} -> ${r.status}: ${JSON.stringify(r.json)}`);
  return r.json;
}


async function main() {
  console.log('Waiting for dashboard...');
  const start = Date.now();
  while (Date.now() - start < 120_000) {
    try {
      const r = await call('GET', '/scenario-config');
      if (r.status === 200) break;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1000));
  }

  const cfg = await ok('GET', '/scenario-config');
  const existingScenarios: string[] = cfg.scenarios ?? [];
  console.log('Existing scenarios:', existingScenarios);

  // 1. Create guide-demo-2 if missing
  if (!existingScenarios.includes(BASE_SCENARIO)) {
    console.log(`Creating ${BASE_SCENARIO}...`);
    await ok('POST', '/scenario-config/create', { scenario: BASE_SCENARIO });
  }

  // 2. Create/update the Athens mock in guide-demo-2 with 99° temperature from fixture
  // For SQLite/filesystem provider, write mock files directly to disk
  const crypto = await import('node:crypto');
  const hash = crypto.createHash('sha256').update(ATHENS_ENDPOINT).digest('hex');
  const filename = `${hash}.json`;
  
  // Determine mock-data path
  // CI: runs from e2e/ dir, WanderWeird is at ../example-projects/wanderweird-travel
  // Local: might run from e2e/ or workspace root
  const mockDataRoot = process.env.MOCK_DATA_PATH || 
    join(__dirname, '../example-projects/wanderweird-travel/mock-data');
  
  console.log(`Using mock data root: ${mockDataRoot}`);
  const scenarioDir = join(mockDataRoot, BASE_SCENARIO);
  const mockPath = join(scenarioDir, filename);

  console.log('Creating Athens mock from fixture...');
  const fixtureData = { ...ATHENS_FIXTURE };
  fixtureData.current.temperature_2m = EXPECTED_TEMP[BASE_SCENARIO];
  
  const mockData = {
    endpoint: ATHENS_ENDPOINT,
    method: 'GET',
    response: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: fixtureData,
    },
    replayMode: 'stored',
    timestamp: new Date().toISOString(),
  };

  // Write mock file directly to filesystem
  if (!existsSync(scenarioDir)) {
    mkdirSync(scenarioDir, { recursive: true });
  }
  writeFileSync(mockPath, JSON.stringify(mockData, null, 2));
  console.log(`Created/updated mock: ${filename}`);

  // Verify via API
  const mocks = (await ok('GET', `/mocks?scenario=${BASE_SCENARIO}`)).files ?? [];
  const athensMock = mocks.find((m: any) => m.endpoint?.startsWith(ATHENS_ENDPOINT_PREFIX));
  if (!athensMock) {
    console.log('⚠️  Mock file written but not yet visible via API (may need dashboard restart)');
  }

  // Base mock already created above with correct temperature

  // 3. Create heatwave and rainy-weekend scenarios with correct temperature mocks
  for (const scenario of ['heatwave', 'rainy-weekend']) {
    if (!existingScenarios.includes(scenario)) {
      console.log(`Creating scenario: ${scenario}`);
      await ok('POST', '/scenario-config/create', { scenario });
    }

    // Write mock file with scenario-specific temperature
    const scenarioDir = join(mockDataRoot, scenario);
    const scenarioMockPath = join(scenarioDir, filename);
    const expectedTemp = EXPECTED_TEMP[scenario];
    
    console.log(`Setting ${scenario} temperature to ${expectedTemp}°...`);
    const scenarioFixtureData = { ...ATHENS_FIXTURE };
    scenarioFixtureData.current.temperature_2m = expectedTemp;
    
    const scenarioMockData = {
      endpoint: ATHENS_ENDPOINT,
      method: 'GET',
      response: {
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: scenarioFixtureData,
      },
      replayMode: 'stored',
      timestamp: new Date().toISOString(),
    };

    if (!existsSync(scenarioDir)) {
      mkdirSync(scenarioDir, { recursive: true });
    }
    writeFileSync(scenarioMockPath, JSON.stringify(scenarioMockData, null, 2));
    console.log(`Created/updated ${scenario} mock: ${filename}`);
  }

  // 4. Create wanderweird-demo client lane pointing to guide-demo-2
  const lanes = await ok('GET', '/client-lanes');
  const existingLane = lanes.lanes?.find((l: any) => l.clientId === LANE);
  if (!existingLane) {
    console.log(`Creating client lane ${LANE} -> ${BASE_SCENARIO}...`);
    await ok('PUT', `/client-lanes/${LANE}/scenario`, { scenario: BASE_SCENARIO });
  } else if (existingLane.scenario !== BASE_SCENARIO) {
    console.log(`Updating client lane ${LANE} to ${BASE_SCENARIO}...`);
    await ok('PUT', `/client-lanes/${LANE}/scenario`, { scenario: BASE_SCENARIO });
  } else {
    console.log(`Client lane ${LANE} already points to ${BASE_SCENARIO}`);
  }

  // 5. Create wander-api /discover mocks (required by offline.spec.ts)
  console.log('Waiting for wander-api service...');
  const wanderStart = Date.now();
  let wanderReady = false;
  while (Date.now() - wanderStart < 120_000) {
    try {
      const healthRes = await fetch('http://127.0.0.1:4203/health', { signal: AbortSignal.timeout(2000) });
      if (healthRes.ok) {
        wanderReady = true;
        break;
      }
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (wanderReady) {
    console.log('Creating wander-api discover mocks...');
    const wanderEndpoints = [
      'http://127.0.0.1:4203/discover?destinationKey=atlantis',
      'http://127.0.0.1:4203/discover',
    ];

    for (const url of wanderEndpoints) {
      const existing = (await ok('GET', `/mocks?scenario=${BASE_SCENARIO}`)).files ?? [];
      if (!existing.find((m: any) => m.endpoint === url)) {
        console.log(`Recording wander mock: ${url}`);
        try {
          await ok('POST', '/proxy', {
            url,
            method: 'GET',
            scenario: BASE_SCENARIO,
            allowUpstream: true,
            record: true,
          });

          // Verify mock was created and set replay mode to stored
          const updated = (await ok('GET', `/mocks?scenario=${BASE_SCENARIO}`)).files ?? [];
          const mock = updated.find((m: any) => m.endpoint === url);
          if (mock) {
            await ok('PUT', `/mocks/${mock.filename}?scenario=${BASE_SCENARIO}`, { replayMode: 'stored' });
            console.log(`  Created and configured: ${mock.filename}`);
          } else {
            console.log(`  ⚠️  Could not find mock for ${url} after recording`);
          }
        } catch (err: any) {
          console.log(`  ⚠️  Failed to record ${url}: ${err.message}`);
        }
      } else {
        console.log(`  Mock already exists for ${url}`);
      }
    }
  } else {
    console.log('⚠️  wander-api not available, skipping wander mock creation (offline tests will be skipped)');
  }

  // 6. Set global scenario to guide-demo-2
  const finalCfg = await ok('GET', '/scenario-config');
  if (finalCfg.currentScenario !== BASE_SCENARIO) {
    console.log(`Setting global scenario to ${BASE_SCENARIO}...`);
    await ok('POST', '/scenario-config/set', { scenario: BASE_SCENARIO });
  }

  console.log('✅ Demo data seeded successfully');
  console.log(`   Scenarios: ${BASE_SCENARIO} (99°), heatwave (44°), rainy-weekend (11°)`);
  console.log(`   Client lane: ${LANE} -> ${BASE_SCENARIO}`);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
