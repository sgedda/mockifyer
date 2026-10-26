#!/usr/bin/env node
/**
 * Seed demo scenarios and client lane for the E2E suite.
 * Creates guide-demo-2 (99°), heatwave (44°), rainy-weekend (11°) scenarios
 * with an Open-Meteo Athens forecast mock, plus the wanderweird-demo client lane.
 * Idempotent: can run multiple times safely.
 */
import { DASHBOARD, ATHENS_ENDPOINT_PREFIX, EXPECTED_TEMP, LANE, BASE_SCENARIO } from './lib/env';

const ATHENS_ENDPOINT = `${ATHENS_ENDPOINT_PREFIX}&longitude=23.7275&current=temperature_2m,relative_humidity_2m,wind_speed_10m&hourly=temperature_2m&timezone=Europe%2FAthens`;

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

  // 2. Record/create the Athens mock in guide-demo-2 with 99° temperature
  const mocks = (await ok('GET', `/mocks?scenario=${BASE_SCENARIO}`)).files ?? [];
  let athensMock = mocks.find((m: any) => m.endpoint?.startsWith(ATHENS_ENDPOINT_PREFIX));

  if (!athensMock) {
    console.log('Recording Athens mock...');
    // Create mock via dashboard proxy with allowUpstream to record a real request
    await ok('POST', '/proxy', {
      url: ATHENS_ENDPOINT,
      method: 'GET',
      scenario: BASE_SCENARIO,
      allowUpstream: true,
      record: true,
    });

    const updatedMocks = (await ok('GET', `/mocks?scenario=${BASE_SCENARIO}`)).files ?? [];
    athensMock = updatedMocks.find((m: any) => m.endpoint?.startsWith(ATHENS_ENDPOINT_PREFIX));
    if (!athensMock) throw new Error('Failed to create Athens mock');
    console.log(`Created mock: ${athensMock.filename}`);
  } else {
    console.log(`Athens mock exists: ${athensMock.filename}`);
  }

  // Ensure guide-demo-2 has 99° temperature and is in stored mode
  const mock = await ok('GET', `/mocks/${athensMock.filename}?scenario=${BASE_SCENARIO}`);
  let needsUpdate = false;
  
  if (mock.data?.response?.data?.current) {
    if (mock.data.response.data.current.temperature_2m !== EXPECTED_TEMP[BASE_SCENARIO]) {
      console.log(`Fixing ${BASE_SCENARIO} temperature to ${EXPECTED_TEMP[BASE_SCENARIO]}°...`);
      mock.data.response.data.current.temperature_2m = EXPECTED_TEMP[BASE_SCENARIO];
      needsUpdate = true;
    }
  } else {
    console.log(`⚠️  Mock structure missing current.temperature_2m, skipping temperature fix`);
  }
  
  if (needsUpdate || mock.data?.replayMode !== 'stored') {
    if (mock.data?.response?.data) {
      await ok('PUT', `/mocks/${athensMock.filename}?scenario=${BASE_SCENARIO}`, {
        responseData: mock.data.response.data,
        replayMode: 'stored',
      });
    }
  }

  // 3. Create heatwave and rainy-weekend by cloning guide-demo-2 and changing temperature
  for (const scenario of ['heatwave', 'rainy-weekend']) {
    if (!existingScenarios.includes(scenario)) {
      console.log(`Creating ${scenario} from ${BASE_SCENARIO}...`);
      await ok('POST', '/scenario-config/create', { scenario, deriveFrom: BASE_SCENARIO });
    }

    // Update temperature and ensure replay mode is stored
    const mock = await ok('GET', `/mocks/${athensMock.filename}?scenario=${scenario}`);
    const expectedTemp = EXPECTED_TEMP[scenario];
    let scenarioNeedsUpdate = false;
    
    if (mock.data?.response?.data?.current) {
      if (mock.data.response.data.current.temperature_2m !== expectedTemp) {
        console.log(`Setting ${scenario} temperature to ${expectedTemp}°...`);
        mock.data.response.data.current.temperature_2m = expectedTemp;
        scenarioNeedsUpdate = true;
      }
    } else {
      console.log(`⚠️  Mock structure missing current.temperature_2m in ${scenario}, skipping`);
    }
    
    if (scenarioNeedsUpdate || mock.data?.replayMode !== 'stored') {
      if (mock.data?.response?.data) {
        await ok('PUT', `/mocks/${athensMock.filename}?scenario=${scenario}`, {
          responseData: mock.data.response.data,
          replayMode: 'stored',
        });
      }
    }
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
        await ok('POST', '/proxy', {
          url,
          method: 'GET',
          scenario: BASE_SCENARIO,
          allowUpstream: true,
          record: true,
        });

        // Set replay mode to stored
        const updated = (await ok('GET', `/mocks?scenario=${BASE_SCENARIO}`)).files ?? [];
        const mock = updated.find((m: any) => m.endpoint === url);
        if (mock) {
          await ok('PUT', `/mocks/${mock.filename}?scenario=${BASE_SCENARIO}`, { replayMode: 'stored' });
        }
      }
    }
  } else {
    console.log('⚠️  wander-api not available, skipping wander mock creation (tests may fail)');
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
