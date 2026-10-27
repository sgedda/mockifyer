/**
 * Test data setup - creates scenarios and mocks on-demand
 * Can be called from test beforeAll hooks
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dashboard } from './dashboard';
import { BASE_SCENARIO, EXPECTED_TEMP, ATHENS_ENDPOINT, LANE } from './env';
import type { MockData } from '@sgedda/mockifyer-core';
import { generateRequestKey } from '@sgedda/mockifyer-core';
import crypto from 'node:crypto';

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
  
  // Create BASE scenario first if missing
  if (!existingScenarios.includes(BASE_SCENARIO)) {
    console.log(`[Setup] Creating base scenario: ${BASE_SCENARIO}`);
    await dashboard.createScenario(BASE_SCENARIO);
  }
  
  // Check if Athens mock exists in base scenario
  const baseMocks = await dashboard.listMocks(BASE_SCENARIO);
  let athensMock = baseMocks.find((m: any) => m.endpoint === ATHENS_ENDPOINT);
  
  if (!athensMock) {
    console.log('[Setup] Athens mock not found, creating via proxy recording...');
    
    // First, create the mock entry via proxy (this creates the filename)
    // Note: recordResponses:true in body is IGNORED because dashboard:sqlite has MOCKIFYER_RECORD_RESPONSES=false
    try {
      const proxyResult = await dashboard.call('POST', '/proxy', {
        url: ATHENS_ENDPOINT,
        method: 'GET',
        scenario: BASE_SCENARIO,
        allowUpstream: true,
        record: true,
      });
      
      if (proxyResult.status === 200) {
        console.log('[Setup] ✓ Created Athens mock entry');
      } else {
        console.warn(`[Setup] ⚠️  Proxy recording returned status ${proxyResult.status}`);
      }
    } catch (err: any) {
      console.warn('[Setup] ⚠️  Failed to create mock entry:', err.message);
      return false;
    }
    
    // Re-fetch to get the mock entry (will have responsePending:true, status 0, data null)
    const updatedMocks = await dashboard.listMocks(BASE_SCENARIO);
    athensMock = updatedMocks.find((m: any) => m.endpoint === ATHENS_ENDPOINT);
    
    if (!athensMock) {
      console.error('[Setup] ❌ Mock entry not created');
      return false;
    }
    
    // Fetch actual response from Open-Meteo API (retry up to 3 times)
    let liveData = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Setup] Fetching live data from Open-Meteo API (attempt ${attempt}/3)...`);
        const liveRes = await fetch(ATHENS_ENDPOINT);
        if (liveRes.ok) {
          liveData = await liveRes.json();
          console.log('[Setup] ✓ Got live response from Open-Meteo API');
          break;
        }
      } catch (err: any) {
        console.warn(`[Setup] Attempt ${attempt} failed:`, err.message);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000)); // 2s delay before retry
        }
      }
    }
    
    // Fall back to fixture if live fetch failed
    if (!liveData) {
      console.warn('[Setup] ⚠️  Failed to fetch live data after 3 attempts, using fixture');
      liveData = ATHENS_FIXTURE;
    }
    
    // Write response data into the existing mock via PUT
    await dashboard.putMock(athensMock.filename, {
      responseData: liveData,
      replayMode: 'stored',
      alwaysUseRealApi: false,
    }, BASE_SCENARIO);
    
    console.log('[Setup] ✓ Wrote response data to mock');
    
    // Validate the mock has temperature data
    const mockData = await dashboard.getMock(athensMock.filename, BASE_SCENARIO);
    const temp = mockData.data?.response?.data?.current?.temperature_2m;
    if (typeof temp !== 'number') {
      console.error('[Setup] ❌ Mock is missing current.temperature_2m field');
      console.error('[Setup] Mock structure:', JSON.stringify(mockData.data?.response?.data?.current, null, 2));
      throw new Error('Athens mock is invalid: missing current.temperature_2m field');
    }
    console.log(`[Setup] ✓ Mock validated with temperature: ${temp}°`);
  }
  
  console.log(`[Setup] Athens mock found: ${athensMock.filename}`);
  
  // Ensure correct temperatures for each scenario (guide-demo-2: 99, heatwave: 44, rainy-weekend: 11)
  for (const [scenario, expectedTemp] of Object.entries(EXPECTED_TEMP)) {
    // Check if scenario exists
    const config2 = await dashboard.scenarioConfig();
    const scenarios = config2.scenarios || [];
    
    if (!scenarios.includes(scenario)) {
      if (scenario === BASE_SCENARIO) {
        // BASE should already exist, but create if missing
        console.log(`[Setup] Creating missing BASE scenario: ${BASE_SCENARIO}`);
        await dashboard.createScenario(BASE_SCENARIO);
      } else {
        // Create by deriving from base scenario (this copies the Athens mock)
        console.log(`[Setup] Creating ${scenario} by deriving from ${BASE_SCENARIO}...`);
        await dashboard.createScenario(scenario, BASE_SCENARIO);
      }
    }
    
    // Check if scenario has Athens mock
    const scenarioMocks = await dashboard.listMocks(scenario);
    const scenarioAthensMock = scenarioMocks.find((m: any) => m.endpoint === ATHENS_ENDPOINT);
    
    if (!scenarioAthensMock) {
      console.warn(`[Setup] ⚠️  ${scenario} is missing Athens mock (skipping temperature update)`);
      continue;
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
        alwaysUseRealApi: false,
      }, scenario);
    }
  }
  
  // Create the wanderweird-demo lane if it doesn't exist
  console.log(`[Setup] Ensuring ${LANE} lane exists...`);
  try {
    const lanesResult = await dashboard.lanes();
    const demoLane = lanesResult.lanes.find((l: any) => l.clientId === LANE);
    if (!demoLane) {
      console.log(`[Setup] Creating lane: ${LANE}`);
      await dashboard.call('PUT', `/client-lanes/${LANE}/scenario`, { scenario: BASE_SCENARIO });
    } else {
      console.log(`[Setup] Lane ${LANE} already exists`);
    }
  } catch (err: any) {
    console.warn(`[Setup] Could not create lane ${LANE}:`, err.message);
  }
  
  // Delete internal hop mocks (gateway->wander-api) that would block wander-api from running
  console.log('[Setup] Cleaning up internal hop mocks...');
  for (const scenario of [BASE_SCENARIO, 'heatwave', 'rainy-weekend']) {
    const mocks = await dashboard.listMocks(scenario);
    const internalMocks = mocks.filter((m: any) => m.endpoint?.startsWith('http://127.0.0.1:42'));
    for (const mock of internalMocks) {
      console.log(`[Setup]   Deleting internal mock in ${scenario}: ${mock.endpoint}`);
      await dashboard.deleteMock(mock.filename, scenario);
    }
  }
  
  // List guide-demo-2 mocks to verify setup (should show exactly one Open-Meteo Athens mock with 99°)
  console.log('[Setup] Listing guide-demo-2 mocks:');
  const finalMocks = await dashboard.listMocks(BASE_SCENARIO);
  for (const mock of finalMocks) {
    console.log(`[Setup]   - ${mock.endpoint} -> ${mock.filename}`);
  }
  
  // Reset global scenario to BASE_SCENARIO (scenario creates switch the global scenario)
  console.log(`[Setup] Resetting global scenario to ${BASE_SCENARIO}...`);
  await dashboard.setGlobalScenario(BASE_SCENARIO);
  
  // Reset wanderweird-demo lane to BASE_SCENARIO
  try {
    console.log(`[Setup] Resetting ${LANE} lane to ${BASE_SCENARIO}...`);
    await dashboard.call('PUT', `/client-lanes/${LANE}/scenario`, { scenario: BASE_SCENARIO });
  } catch (err: any) {
    console.warn(`[Setup] Could not reset ${LANE} lane:`, err.message);
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
    const hasMock = mocks.some((m: any) => m.endpoint === ATHENS_ENDPOINT);
    
    return hasMock;
  } catch {
    return false;
  }
}
