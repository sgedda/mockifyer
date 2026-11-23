/**
 * Replay the recorded mock with the network blocked.
 * Proves the response comes from disk, not from the live API.
 */
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

const URL = 'https://jsonplaceholder.typicode.com/todos/1';

// Block network before Mockifyer wraps fetch. Matching mocks never call through.
globalThis.fetch = async (input) => {
  const target = typeof input === 'string' ? input : String(input?.url ?? input);
  throw new Error(`Network blocked — attempted: ${target}`);
};

setupMockifyer({
  mockDataPath: './mock-data',
  defaultScenario: 'default',
  recordMode: false,
  useGlobalFetch: true,
  domainPathRulesMode: 'record_all',
  failOnMissingMock: true,
});

async function replay() {
  console.log('Replaying from mock (network blocked)…\n');
  console.log(`GET ${URL}`);

  const response = await fetch(URL);
  const data = await response.json();

  console.log(`✓ Status ${response.status}`);
  console.log('✓ Body:', JSON.stringify(data, null, 2));
  console.log('\n✓ Served from mock — 0 network calls');
  console.log('Try: npm run record  (needs outbound network) then npm run replay again');
}

replay().catch((error) => {
  console.error('Replay failed:', error);
  console.error(
    '\nIf the mock is missing, run: npm run record\n' +
      '(Requires outbound HTTPS. On StackBlitz, file writes usually work; the dashboard does not.)'
  );
  process.exit(1);
});
