/**
 * Global setup - runs once before all tests
 * Creates test scenarios and mocks on-demand
 */

import { ensureTestData } from './lib/setup';

async function verifyService(name: string, url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      console.log(`[Verify] ✓ ${name} responding (${url})`);
      return true;
    } else {
      console.error(`[Verify] ✗ ${name} returned ${res.status} (${url})`);
      return false;
    }
  } catch (err: any) {
    console.error(`[Verify] ✗ ${name} unreachable: ${err.message} (${url})`);
    return false;
  }
}

async function verifyAthensMock(): Promise<boolean> {
  try {
    const res = await fetch('http://127.0.0.1:4203/discover?destinationKey=atlantis', {
      headers: { 'X-Mockifyer-Client-Id': 'wanderweird-demo' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[Verify] ✗ Athens endpoint returned ${res.status}`);
      return false;
    }
    const data = await res.json();
    const temp = data?.weather?.current?.temperature_2m;
    if (temp === 99) {
      console.log(`[Verify] ✓ Athens mock serving temperature 99°`);
      return true;
    } else {
      console.error(`[Verify] ✗ Athens mock temperature is ${temp}, expected 99° (source: ${data?.weather?.source || 'unknown'})`);
      return false;
    }
  } catch (err: any) {
    console.error(`[Verify] ✗ Athens mock check failed: ${err.message}`);
    return false;
  }
}

export default async function globalSetup() {
  console.log('\n=== E2E Global Setup ===\n');
  
  const success = await ensureTestData();
  
  if (!success) {
    throw new Error('Test data setup failed - see errors above');
  }
  
  console.log('\n[Verify] Checking services...\n');
  
  const checks = await Promise.all([
    verifyService('Dashboard', 'http://127.0.0.1:3002/api/health'),
    verifyService('Gateway', 'http://127.0.0.1:4200/health'),
    verifyService('Wander-api', 'http://127.0.0.1:4203/health'),
    verifyService('Metro', 'http://127.0.0.1:8090'),
    verifyAthensMock(),
  ]);
  
  const allPassed = checks.every(c => c);
  
  if (!allPassed) {
    throw new Error('Service verification failed - one or more services not responding or mock not working');
  }
  
  console.log('\n✓ All services verified and mocks working\n');
}
