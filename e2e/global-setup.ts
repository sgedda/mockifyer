/**
 * Global setup - runs once before all tests
 * Creates test scenarios and mocks on-demand
 */

import { ensureTestData } from './lib/setup';

export default async function globalSetup() {
  console.log('\n=== E2E Global Setup ===\n');
  
  const success = await ensureTestData();
  
  if (!success) {
    console.warn('\n⚠️  Test data setup incomplete - some tests may be skipped\n');
  } else {
    console.log('\n✓ Global setup complete\n');
  }
}
