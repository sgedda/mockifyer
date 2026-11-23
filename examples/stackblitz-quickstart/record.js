/**
 * Record one real public API response into ./mock-data.
 *
 * Capture-all settings (for a quick demo only — not the default selective workflow):
 * - MOCKIFYER_RECORD_RESPONSES=true
 * - MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API=false
 * - domainPathRulesMode: 'record_all'
 *
 * See https://mockifyer.dev/getting-started for selective recording (recommended).
 */
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = 'false';
process.env.MOCKIFYER_RECORD_RESPONSES = 'true';

setupMockifyer({
  mockDataPath: './mock-data',
  defaultScenario: 'default',
  recordMode: true,
  useGlobalFetch: true,
  domainPathRulesMode: 'record_all',
});

const URL = 'https://jsonplaceholder.typicode.com/todos/1';

async function record() {
  console.log('Recording real API response…\n');
  console.log(`GET ${URL}`);

  const response = await fetch(URL);
  const data = await response.json();

  console.log(`✓ Status ${response.status}`);
  console.log('✓ Body:', JSON.stringify(data, null, 2));
  console.log('\nSaved under mock-data/default/');
  console.log('Next: npm run replay  (works with the network blocked)');
}

record().catch((error) => {
  console.error('Record failed:', error);
  process.exit(1);
});
