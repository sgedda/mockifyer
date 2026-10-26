#!/usr/bin/env node
/**
 * Seed demo scenarios and client lane for the E2E suite.
 * Creates guide-demo-2 (99°), heatwave (44°), rainy-weekend (11°) scenarios
 * with an Open-Meteo Athens forecast mock, plus the wanderweird-demo client lane.
 * Idempotent: can run multiple times safely.
 * 
 * Uses a committed fixture (fixtures/athens-forecast.json) for deterministic seeding.
 * For filesystem provider: writes JSON mock files directly to disk.
 * For SQLite/Redis: uses proxy endpoint to record (requires external API access).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DASHBOARD, ATHENS_ENDPOINT_PREFIX, EXPECTED_TEMP, LANE, BASE_SCENARIO } from './lib/env';
import type { MockData } from '@sgedda/mockifyer-core';
import { generateRequestKey } from '@sgedda/mockifyer-core';

// Use local mock server for recording (reliable, no external API dependency)
const USE_LOCAL_MOCK_SERVER = process.env.CI === 'true' || process.env.USE_LOCAL_MOCK === 'true';
const MOCK_API_URL = 'http://127.0.0.1:9999';
const ATHENS_ENDPOINT = USE_LOCAL_MOCK_SERVER
  ? `${MOCK_API_URL}/v1/forecast?latitude=37.9838&longitude=23.7275&current=temperature_2m,relative_humidity_2m,wind_speed_10m&hourly=temperature_2m&timezone=Europe%2FAthens`
  : `${ATHENS_ENDPOINT_PREFIX}&longitude=23.7275&current=temperature_2m,relative_humidity_2m,wind_speed_10m&hourly=temperature_2m&timezone=Europe%2FAthens`;

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
  // For filesystem provider: write JSON mock files directly
  // For SQLite/Redis: use proxy endpoint (requires external API access)
  console.log('Creating Athens mock from fixture...');
  
  // Detect provider type from dashboard health endpoint
  const health = await ok('GET', '/health');
  const providerType = health.provider || 'filesystem';
  const canWriteFiles = providerType === 'filesystem';
  
  console.log(`  Dashboard provider: ${providerType}`);
  
  const mockDataRoot = process.env.MOCK_DATA_PATH || 
    join(__dirname, '../example-projects/wanderweird-travel/mock-data');
  const scenarioDir = join(mockDataRoot, BASE_SCENARIO);
  
  const mocks = (await ok('GET', `/mocks?scenario=${BASE_SCENARIO}`)).files ?? [];
  let athensMock = mocks.find((m: any) => m.endpoint?.startsWith(ATHENS_ENDPOINT_PREFIX));

  if (!athensMock && canWriteFiles) {
    console.log('  Writing Athens mock file directly (filesystem provider)...');
    
    const fixtureData = { ...ATHENS_FIXTURE };
    fixtureData.current.temperature_2m = EXPECTED_TEMP[BASE_SCENARIO];
    
    const mockData: MockData = {
      request: {
        method: 'GET',
        url: ATHENS_ENDPOINT,
        headers: {},
      },
      response: {
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: fixtureData,
      },
      timestamp: new Date().toISOString(),
    };
    
    // Calculate hash-based filename
    const crypto = await import('node:crypto');
    const requestKey = generateRequestKey(mockData.request);
    const hash = crypto.createHash('sha256').update(requestKey).digest('hex');
    const filename = `${hash}.json`;
    
    // Write mock file
    if (!existsSync(scenarioDir)) {
      mkdirSync(scenarioDir, { recursive: true });
    }
    writeFileSync(join(scenarioDir, filename), JSON.stringify(mockData, null, 2));
    console.log(`  ✓ Created mock file: ${filename}`);
    
    // Verify via API
    const updatedMocks = (await ok('GET', `/mocks?scenario=${BASE_SCENARIO}`)).files ?? [];
    athensMock = updatedMocks.find((m: any) => m.endpoint?.startsWith(ATHENS_ENDPOINT_PREFIX));
    if (!athensMock) {
      throw new Error('Mock file written but not visible via dashboard API');
    }
  } else if (!athensMock) {
  } else if (!athensMock) {
    // Fallback for SQLite/Redis: record via proxy (requires external API)
    console.log('  Recording Athens mock via proxy (SQLite/Redis provider)...');
    
    // Try to record from real API with retries
    let recorded = false;
    for (let attempt = 1; attempt <= 3 && !recorded; attempt++) {
      try {
        const proxyResult = await call('POST', '/proxy', {
          url: ATHENS_ENDPOINT,
          method: 'GET',
          scenario: BASE_SCENARIO,
          allowUpstream: true,
          record: true,
        });

        if (proxyResult.status === 200) {
          // Verify the mock was created with valid data
          const updatedMocks = (await ok('GET', `/mocks?scenario=${BASE_SCENARIO}`)).files ?? [];
          athensMock = updatedMocks.find((m: any) => m.endpoint?.startsWith(ATHENS_ENDPOINT_PREFIX));
          
          if (athensMock) {
            const checkMock = await ok('GET', `/mocks/${athensMock.filename}?scenario=${BASE_SCENARIO}`);
            if (checkMock.data?.response?.status > 0 && checkMock.data?.response?.data) {
              console.log(`  ✓ Recorded mock: ${athensMock.filename}`);
              recorded = true;
            } else {
              console.log(`  ⚠️  Attempt ${attempt}: Mock recorded but response is empty (status: ${checkMock.data?.response?.status})`);
              athensMock = null; // Try again
            }
          }
        } else {
          console.log(`  ⚠️  Attempt ${attempt}: Proxy returned ${proxyResult.status}`);
        }
      } catch (err: any) {
        console.log(`  ⚠️  Attempt ${attempt}: ${err.message}`);
      }
      
      if (!recorded && attempt < 3) {
        console.log('  Retrying in 2 seconds...');
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!athensMock) {
      throw new Error(
        'Failed to record Athens mock from Open-Meteo API after 3 attempts. ' +
        'The external API may be down or unreachable from CI. ' +
        'Consider switching to filesystem provider or pre-seeding mock data.'
      );
    }
  } else {
    console.log(`  Athens mock already exists: ${athensMock.filename}`);
  }

  // Update temperature to expected value for base scenario
  const baseMock = await ok('GET', `/mocks/${athensMock.filename}?scenario=${BASE_SCENARIO}`);
  
  if (!baseMock.data?.response?.data?.current) {
    console.error(`❌ Mock structure invalid for ${BASE_SCENARIO}/${athensMock.filename}`);
    console.error('Expected: { data: { response: { data: { current: { temperature_2m: number } } } } }');
    console.error('Actual:', JSON.stringify(baseMock, null, 2).substring(0, 500));
    throw new Error(`Mock missing current.temperature_2m in ${BASE_SCENARIO}`);
  }

  if (baseMock.data.response.data.current.temperature_2m !== EXPECTED_TEMP[BASE_SCENARIO]) {
    console.log(`  Setting ${BASE_SCENARIO} temperature to ${EXPECTED_TEMP[BASE_SCENARIO]}°...`);
    baseMock.data.response.data.current.temperature_2m = EXPECTED_TEMP[BASE_SCENARIO];
    await ok('PUT', `/mocks/${athensMock.filename}?scenario=${BASE_SCENARIO}`, {
      responseData: baseMock.data.response.data,
      replayMode: 'stored',
    });
  }

  // Base mock already created above with correct temperature

  // 3. Create heatwave and rainy-weekend scenarios with correct temperatures
  for (const scenario of ['heatwave', 'rainy-weekend']) {
    if (!existingScenarios.includes(scenario)) {
      console.log(`Creating ${scenario}...`);
      const createParams = canWriteFiles 
        ? { scenario } 
        : { scenario, deriveFrom: BASE_SCENARIO };
      await ok('POST', '/scenario-config/create', createParams);
    }

    if (canWriteFiles) {
      // Filesystem: write mock file directly
      const scenarioDir = join(mockDataRoot, scenario);
      const expectedTemp = EXPECTED_TEMP[scenario];
      
      console.log(`Setting ${scenario} temperature to ${expectedTemp}°...`);
      const fixtureData = { ...ATHENS_FIXTURE };
      fixtureData.current.temperature_2m = expectedTemp;
      
      const mockData: MockData = {
        request: {
          method: 'GET',
          url: ATHENS_ENDPOINT,
          headers: {},
        },
        response: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          data: fixtureData,
        },
        timestamp: new Date().toISOString(),
      };
      
      const crypto = await import('node:crypto');
      const requestKey = generateRequestKey(mockData.request);
      const hash = crypto.createHash('sha256').update(requestKey).digest('hex');
      const filename = `${hash}.json`;
      
      if (!existsSync(scenarioDir)) {
        mkdirSync(scenarioDir, { recursive: true });
      }
      writeFileSync(join(scenarioDir, filename), JSON.stringify(mockData, null, 2));
      console.log(`  ✓ Created ${scenario} mock: ${filename}`);
    } else {
      // SQLite/Redis: update via API
      // SQLite/Redis: update via API
      const scenarioMock = await ok('GET', `/mocks/${athensMock.filename}?scenario=${scenario}`);
      const expectedTemp = EXPECTED_TEMP[scenario];
      
      if (!scenarioMock.data?.response?.data?.current) {
        console.error(`❌ Mock structure invalid for ${scenario}/${athensMock.filename}`);
        console.error('Expected: { data: { response: { data: { current: { temperature_2m: number } } } } }');
        console.error('Actual:', JSON.stringify(scenarioMock, null, 2).substring(0, 500));
        throw new Error(`Mock missing current.temperature_2m in ${scenario}`);
      }

      let scenarioNeedsUpdate = false;
      if (scenarioMock.data.response.data.current.temperature_2m !== expectedTemp) {
        console.log(`Setting ${scenario} temperature to ${expectedTemp}°...`);
        scenarioMock.data.response.data.current.temperature_2m = expectedTemp;
        scenarioNeedsUpdate = true;
      }
      
      if (scenarioNeedsUpdate || scenarioMock.data?.replayMode !== 'stored') {
        await ok('PUT', `/mocks/${athensMock.filename}?scenario=${scenario}`, {
          responseData: scenarioMock.data.response.data,
          replayMode: 'stored',
        });
      }
    }
  }

  // 4. Create wanderweird-demo client lane pointing to guide-demo-2
  // Note: Client lanes only work with Redis/SQLite providers, not filesystem
  if (canWriteFiles) {
    console.log('⚠️  Skipping client lane setup (filesystem provider does not support client lanes)');
    console.log('   Tests that require client lanes will use global scenario instead');
  } else {
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
