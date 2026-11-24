/**
 * Selective record: call public APIs and save full response bodies only for
 * allowlisted URL patterns (not capture-all).
 *
 * Intended Mockifyer flow (no dashboard in StackBlitz):
 * - domainPathRulesMode: 'allowlist' (default)
 * - recordResponses: host/path patterns for the endpoints you care about
 * - Matching URLs get full bodies + autoMock; others stay request-only stubs
 *
 * See https://mockifyer.dev/getting-started
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import { RECORD_RESPONSES_PATTERNS, USERS_URL, WEATHER_URL } from './urls.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_ROOT = path.join(__dirname, 'mock-data');
const SCENARIO_DIR = path.join(MOCK_ROOT, 'default');
const RULES_PATH = path.join(SCENARIO_DIR, 'domain-path-rules.json');
const SEED_RULES_PATH = path.join(__dirname, 'domain-path-rules.seed.json');

/**
 * Activate only the demo endpoints via domain-path rules (selective recording).
 * Same outcome as flipping Record + Auto-mock in the dashboard Domains tree —
 * without needing the dashboard in WebContainers.
 */
function seedDomainPathRules() {
  fs.mkdirSync(SCENARIO_DIR, { recursive: true });
  const seed = fs.readFileSync(SEED_RULES_PATH, 'utf8');
  fs.writeFileSync(RULES_PATH, seed, 'utf8');
}

seedDomainPathRules();

setupMockifyer({
  mockDataPath: './mock-data',
  defaultScenario: 'default',
  recordMode: true,
  useGlobalFetch: true,
  domainPathRulesMode: 'allowlist',
  recordResponses: RECORD_RESPONSES_PATTERNS,
});

async function fetchAndLog(label, url) {
  console.log(`\n${label}`);
  console.log(`GET ${url}`);
  const response = await fetch(url);
  const data = await response.json();
  console.log(`✓ Status ${response.status}`);
  console.log('✓ Body:', JSON.stringify(data, null, 2).slice(0, 500));
  return { url, status: response.status, data };
}

function findNewestMockUnder(dir) {
  if (!fs.existsSync(dir)) return null;
  /** @type {{ filePath: string, mtimeMs: number }[]} */
  const found = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.isFile() && entry.name.startsWith('GET_') && entry.name.endsWith('.json')) {
        found.push({ filePath: full, mtimeMs: fs.statSync(full).mtimeMs });
      }
    }
  };
  walk(dir);
  if (found.length === 0) return null;
  found.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return found[0].filePath;
}

async function record() {
  console.log('Selective recording (allowlist + recordResponses patterns)…');
  console.log('Patterns:', RECORD_RESPONSES_PATTERNS.join(', '));

  await fetchAndLog('① JSONPlaceholder /users/1', USERS_URL);
  await fetchAndLog('② Open-Meteo forecast (Berlin)', WEATHER_URL);

  // Give the interceptor a turn to finish writing mock files + async rule persists.
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Re-assert selective allowlist (async discover/enableAutoMock can race on exit).
  seedDomainPathRules();

  const usersDir = path.join(SCENARIO_DIR, 'jsonplaceholder.typicode.com', 'users');
  const usersMock = findNewestMockUnder(usersDir);
  if (!usersMock) {
    throw new Error(`No mock file written under ${usersDir}`);
  }

  const relative = path.relative(__dirname, usersMock);
  fs.writeFileSync(path.join(__dirname, 'last-mock-path.txt'), relative, 'utf8');

  console.log('\n✓ Saved under mock-data/default/');
  console.log(`✓ Domain-path rules activated for allowlisted hosts only`);
  console.log(`✓ Primary mock for generate: ${relative}`);
  console.log('\nNext: npm run replay  then  npm run generate');
}

record().catch((error) => {
  console.error('Record failed:', error);
  process.exit(1);
});
