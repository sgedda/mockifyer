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

/** Open-Meteo Athens forecast response fixture (public API, no secrets). */
const ATHENS_MOCK_FIXTURE = {
  latitude: 37.984,
  longitude: 23.727997,
  generationtime_ms: 0.08296966552734375,
  utc_offset_seconds: 7200,
  timezone: 'Europe/Athens',
  timezone_abbreviation: 'EET',
  elevation: 126.0,
  current_units: { time: 'iso8601', interval: 'seconds', temperature_2m: '°C', relative_humidity_2m: '%', wind_speed_10m: 'km/h' },
  current: { time: '2024-03-15T14:00', interval: 900, temperature_2m: 18.5, relative_humidity_2m: 65, wind_speed_10m: 12.3 },
  hourly_units: { time: 'iso8601', temperature_2m: '°C' },
  hourly: {
    time: Array.from({ length: 24 }, (_, i) => `2024-03-15T${String(i).padStart(2, '0')}:00`),
    temperature_2m: Array.from({ length: 24 }, (_, i) => 15 + Math.sin(i / 24 * Math.PI * 2) * 5),
  },
};

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
    // Try to fetch live API, fall back to fixture
    let liveData: any;
    try {
      const liveRes = await fetch(ATHENS_ENDPOINT, { signal: AbortSignal.timeout(5000) });
      if (liveRes.ok) liveData = await liveRes.json();
    } catch { /* use fixture */ }

    const mockData = liveData ?? ATHENS_MOCK_FIXTURE;
    // Set temperature to 99° for guide-demo-2
    mockData.current.temperature_2m = EXPECTED_TEMP[BASE_SCENARIO];

    // Create mock via dashboard proxy (simulates a recorded request)
    const proxyRes = await call('POST', '/proxy', {
      url: ATHENS_ENDPOINT,
      method: 'GET',
      scenario: BASE_SCENARIO,
      allowUpstream: false,
      response: { status: 200, headers: { 'content-type': 'application/json' }, data: mockData },
    });

    if (proxyRes.status !== 200) {
      // Fallback: use the mock store directly (not all dashboard builds have POST /proxy)
      console.log('Proxy unavailable, seeding mock file directly...');
      const filename = `${ATHENS_ENDPOINT.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
      await ok('PUT', `/mocks/${filename}?scenario=${BASE_SCENARIO}`, {
        responseData: {
          endpoint: ATHENS_ENDPOINT,
          method: 'GET',
          response: { status: 200, headers: { 'content-type': 'application/json' }, data: mockData },
        },
      });
    }

    const updatedMocks = (await ok('GET', `/mocks?scenario=${BASE_SCENARIO}`)).files ?? [];
    athensMock = updatedMocks.find((m: any) => m.endpoint?.startsWith(ATHENS_ENDPOINT_PREFIX));
    if (!athensMock) throw new Error('Failed to create Athens mock');
    console.log(`Created mock: ${athensMock.filename}`);
  } else {
    console.log(`Athens mock exists: ${athensMock.filename}`);
    // Ensure guide-demo-2 has 99° temperature
    const mock = await ok('GET', `/mocks/${athensMock.filename}?scenario=${BASE_SCENARIO}`);
    if (mock.data?.response?.data?.current?.temperature_2m !== EXPECTED_TEMP[BASE_SCENARIO]) {
      console.log(`Fixing ${BASE_SCENARIO} temperature to ${EXPECTED_TEMP[BASE_SCENARIO]}°...`);
      mock.data.response.data.current.temperature_2m = EXPECTED_TEMP[BASE_SCENARIO];
      await ok('PUT', `/mocks/${athensMock.filename}?scenario=${BASE_SCENARIO}`, { responseData: mock.data });
    }
  }

  // 3. Create heatwave and rainy-weekend by cloning guide-demo-2 and changing temperature
  for (const scenario of ['heatwave', 'rainy-weekend']) {
    if (!existingScenarios.includes(scenario)) {
      console.log(`Creating ${scenario} from ${BASE_SCENARIO}...`);
      await ok('POST', '/scenario-config/create', { scenario, deriveFrom: BASE_SCENARIO });
    }

    // Update temperature
    const mock = await ok('GET', `/mocks/${athensMock.filename}?scenario=${scenario}`);
    const expectedTemp = EXPECTED_TEMP[scenario];
    if (mock.data?.response?.data?.current?.temperature_2m !== expectedTemp) {
      console.log(`Setting ${scenario} temperature to ${expectedTemp}°...`);
      mock.data.response.data.current.temperature_2m = expectedTemp;
      await ok('PUT', `/mocks/${athensMock.filename}?scenario=${scenario}`, { responseData: mock.data });
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

  // 5. Set global scenario to guide-demo-2
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
