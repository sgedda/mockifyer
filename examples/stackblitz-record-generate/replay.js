/**
 * Replay recorded mocks with the network blocked.
 * Proves the second call is a mock hit (0 network calls).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import { RECORD_RESPONSES_PATTERNS, USERS_URL, WEATHER_URL } from './urls.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.join(__dirname, 'mock-data', 'default', 'domain-path-rules.json');
const SEED_RULES_PATH = path.join(__dirname, 'domain-path-rules.seed.json');

// Selective activation: only the seeded allowlisted paths may replay.
fs.mkdirSync(path.dirname(RULES_PATH), { recursive: true });
fs.copyFileSync(SEED_RULES_PATH, RULES_PATH);

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
  domainPathRulesMode: 'allowlist',
  recordResponses: RECORD_RESPONSES_PATTERNS,
  failOnMissingMock: true,
});

async function replayOne(label, url) {
  console.log(`\n${label}`);
  console.log(`GET ${url}`);
  const response = await fetch(url);
  const data = await response.json();
  console.log(`✓ Status ${response.status}`);
  console.log('✓ Body:', JSON.stringify(data, null, 2).slice(0, 400));
  console.log('✓ Mock hit (network was blocked)');
}

async function replay() {
  console.log('Replaying from mock-data (network blocked)…');

  await replayOne('① JSONPlaceholder /users/1', USERS_URL);
  await replayOne('② Open-Meteo forecast', WEATHER_URL);

  console.log('\n✓ Served from mock — 0 network calls');
  console.log('Next: npm run generate  (needs @sgedda/mockifyer-generator)');
}

replay().catch((error) => {
  console.error('Replay failed:', error);
  console.error(
    '\nIf mocks are missing, run: npm run record\n' +
      '(Requires outbound HTTPS. On StackBlitz, file writes usually work.)'
  );
  process.exit(1);
});
