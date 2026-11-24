/**
 * Generate edge-case variants from the recorded mock via the generator CLI:
 *   mockifyer-generate variants <mock.json> --level mild --seed 42 --dry-run
 *   mockifyer-generate variants <mock.json> --out ./mock-data --scenario-prefix generated
 *
 * Generator is optional until `@sgedda/mockifyer-generator` is on npm.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { GENERATOR_PUBLISH_HINT, resolveGenerator } from './generator-resolve.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findUsersMock() {
  const marker = path.join(__dirname, 'last-mock-path.txt');
  if (fs.existsSync(marker)) {
    const rel = fs.readFileSync(marker, 'utf8').trim();
    const abs = path.resolve(__dirname, rel);
    if (fs.existsSync(abs)) return abs;
  }

  const usersRoot = path.join(
    __dirname,
    'mock-data',
    'default',
    'jsonplaceholder.typicode.com',
    'users'
  );
  if (!fs.existsSync(usersRoot)) return null;

  /** @type {string[]} */
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.startsWith('GET_') && entry.name.endsWith('.json')) files.push(full);
    }
  };
  walk(usersRoot);
  files.sort();
  return files[files.length - 1] ?? null;
}

async function generate() {
  const resolved = await resolveGenerator();
  if (!resolved?.cliPath) {
    console.error(GENERATOR_PUBLISH_HINT);
    process.exit(1);
  }

  const mockPath = findUsersMock();
  if (!mockPath) {
    console.error('No recorded users mock found. Run: npm run record');
    process.exit(1);
  }

  const relMock = path.relative(__dirname, mockPath);
  console.log(`Using mock: ${relMock}`);
  console.log(`Generator: ${resolved.kind} (${resolved.cliPath})\n`);

  console.log('—— dry-run (preview) ——');
  const dry = spawnSync(
    process.execPath,
    [
      resolved.cliPath,
      'variants',
      mockPath,
      '--level',
      'mild',
      '--seed',
      '42',
      '--dry-run',
    ],
    { encoding: 'utf8', cwd: __dirname }
  );
  if (dry.stdout) process.stdout.write(dry.stdout);
  if (dry.stderr) process.stderr.write(dry.stderr);
  if (dry.status !== 0) {
    process.exit(dry.status ?? 1);
  }

  console.log('\n—— write scenarios under mock-data/ ——');
  const write = spawnSync(
    process.execPath,
    [
      resolved.cliPath,
      'variants',
      mockPath,
      '--level',
      'mild',
      '--seed',
      '42',
      '--out',
      './mock-data',
      '--scenario-prefix',
      'generated',
    ],
    { encoding: 'utf8', cwd: __dirname }
  );
  if (write.stdout) process.stdout.write(write.stdout);
  if (write.stderr) process.stderr.write(write.stderr);
  if (write.status !== 0) {
    process.exit(write.status ?? 1);
  }

  console.log('\n✓ Variants written. Replay a variant with:');
  console.log('  MOCKIFYER_SCENARIO=generated-empty-lists npm run replay');
  console.log('  (scenario folder names come from the generator output above)');
}

generate().catch((error) => {
  console.error('Generate failed:', error);
  process.exit(1);
});
