/**
 * Test data setup - creates scenarios and mocks on-demand
 * Can be called from test beforeAll hooks
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dashboard } from './dashboard';
import { BASE_SCENARIO, EXPECTED_TEMP, ATHENS_ENDPOINT_PREFIX } from './env';
import type { MockData } from '@sgedda/mockifyer-core';
import { generateRequestKey } from '@sgedda/mockifyer-core';
import crypto from 'node:crypto';

const ATHENS_ENDPOINT = `${ATHENS_ENDPOINT_PREFIX}&longitude=23.7275&current=temperature_2m,relative_humidity_2m,wind_speed_10m&hourly=temperature_2m&timezone=Europe%2FAthens`;
const ATHENS_FIXTURE = JSON.parse(readFileSync(join(__dirname, '../fixtures/athens-forecast.json'), 'utf8'));

/**
 * Ensures test scenarios exist and have Athens weather mocks with correct temperatures
 * Idempotent - safe to call multiple times
 */
export async function ensureTestData() {
  console.log('[Setup] Ensuring test scenarios and mocks exist...');
  
  // Wait for dashboard to be ready
  console.log('[Setup] Waiting for dashboard...');
  for (let i = 0; i < 30; i++) {
    try {
      const healthRes = await fetch('http://127.0.0.1:3002/api/health');
      if (healthRes.ok) {
        const contentType = healthRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          console.log('[Setup] Dashboard is ready');
          break;
        }
      }
    } catch (err: any) {
      // Dashboard not ready yet
    }
    if (i === 29) {
      console.error('[Setup] ❌ Dashboard not available after 30 seconds');
      return false;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Get provider type
  const health = await fetch('http://127.0.0.1:3002/api/health').then(r => r.json());
  const provider = health.provider || 'filesystem';
  console.log(`[Setup] Provider: ${provider}`);
  
  // Get existing scenarios
  const config = await dashboard.scenarioConfig();
  const existingScenarios = config.scenarios || [];
  
  // Create scenarios if needed
  for (const scenario of [BASE_SCENARIO, 'heatwave', 'rainy-weekend']) {
    if (!existingScenarios.includes(scenario)) {
      console.log(`[Setup] Creating scenario: ${scenario}`);
      await dashboard.createScenario(scenario);
    }
  }
  
  // Check if Athens mock exists in base scenario
  const baseMocks = await dashboard.listMocks(BASE_SCENARIO);
  let athensMock = baseMocks.find((m: any) => m.endpoint?.startsWith(ATHENS_ENDPOINT_PREFIX));
  
  if (!athensMock) {
    console.log('[Setup] Athens mock not found, creating via proxy recording...');
    
    // Record from actual API (will be cached for future test runs)
    try {
      const proxyResult = await dashboard.call('POST', '/proxy', {
        url: ATHENS_ENDPOINT,
        method: 'GET',
        scenario: BASE_SCENARIO,
        allowUpstream: true,
        record: true,
      });
      
      if (proxyResult.status === 200) {
        console.log('[Setup] ✓ Recorded Athens mock from Open-Meteo API');
        // Re-fetch to get the mock
        const updatedMocks = await dashboard.listMocks(BASE_SCENARIO);
        athensMock = updatedMocks.find((m: any) => m.endpoint?.startsWith(ATHENS_ENDPOINT_PREFIX));
        
        // Validate the recorded mock has temperature data
        if (athensMock) {
          const mockData = await dashboard.getMock(athensMock.filename, BASE_SCENARIO);
          const temp = mockData.data?.response?.data?.current?.temperature_2m;
          if (typeof temp !== 'number') {
            console.error('[Setup] ❌ Recorded mock is missing current.temperature_2m field');
            console.error('[Setup] Mock structure:', JSON.stringify(mockData.data?.response?.data?.current, null, 2));
            throw new Error('Recorded Athens mock is invalid: missing current.temperature_2m field');
          }
          console.log(`[Setup] ✓ Mock validated with temperature: ${temp}°`);
        }
      } else {
        console.warn(`[Setup] ⚠️  Proxy recording returned status ${proxyResult.status}`);
      }
    } catch (err: any) {
      console.warn('[Setup] ⚠️  Failed to record from Open-Meteo API:', err.message);
      console.warn('[Setup] Tests that require Athens mock will be skipped');
      return false; // Indicate setup incomplete
    }
  }
  
  if (!athensMock) {
    console.warn('[Setup] ⚠️  Athens mock still not available after recording');
    return false;
  }
  
  console.log(`[Setup] Athens mock found: ${athensMock.filename}`);
  
  // Ensure correct temperatures for each scenario
  for (const [scenario, expectedTemp] of Object.entries(EXPECTED_TEMP)) {
    // Check if scenario has Athens mock
    const scenarioMocks = await dashboard.listMocks(scenario);
    const scenarioAthensMock = scenarioMocks.find((m: any) => m.endpoint?.startsWith(ATHENS_ENDPOINT_PREFIX));
    
    if (!scenarioAthensMock) {
      // Derive from base scenario
      if (scenario !== BASE_SCENARIO) {
        console.log(`[Setup] Deriving ${scenario} from ${BASE_SCENARIO}...`);
        await dashboard.createScenario(scenario, BASE_SCENARIO);
      }
    }
    
    // Check temperature
    const mockData = await dashboard.getMock(athensMock.filename, scenario);
    const currentTemp = mockData.data?.response?.data?.current?.temperature_2m;
    
    if (currentTemp !== expectedTemp) {
      console.log(`[Setup] Updating ${scenario} temperature: ${currentTemp} -> ${expectedTemp}°`);
      mockData.data.response.data.current.temperature_2m = expectedTemp;
      await dashboard.putMock(athensMock.filename, {
        responseData: mockData.data.response.data,
        replayMode: 'stored',
      }, scenario);
    }
  }
  
  console.log('[Setup] ✓ Test data ready');
  return true;
}

/**
 * Quick check if test data is available (without creating it)
 */
export async function hasTestData(): Promise<boolean> {
  try {
    const config = await dashboard.scenarioConfig();
    const scenarios = config.scenarios || [];
    const hasScenarios = ['guide-demo-2', 'heatwave', 'rainy-weekend'].every(s => scenarios.includes(s));
    
    if (!hasScenarios) return false;
    
    const mocks = await dashboard.listMocks(BASE_SCENARIO);
    const hasMock = mocks.some((m: any) => m.endpoint?.startsWith(ATHENS_ENDPOINT_PREFIX));
    
    return hasMock;
  } catch {
    return false;
  }
}
