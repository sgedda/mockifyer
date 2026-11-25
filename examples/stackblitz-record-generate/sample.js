/**
 * CLI sample generation (no recorded mock required):
 *   mockifyer-generate sample --context 'swedish users, 5 items' --seed 7
 *
 * Optional until `@sgedda/mockifyer-generator` is published.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { GENERATOR_PUBLISH_HINT, resolveGenerator } from './generator-resolve.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function sample() {
  const resolved = await resolveGenerator();
  if (!resolved?.cliPath) {
    console.error(GENERATOR_PUBLISH_HINT);
    process.exit(1);
  }

  console.log(`Generator: ${resolved.kind} (${resolved.cliPath})\n`);
  console.log("mockifyer-generate sample --context 'swedish users, 5 items' --seed 7\n");

  const result = spawnSync(
    process.execPath,
    [
      resolved.cliPath,
      'sample',
      '--context',
      'swedish users, 5 items',
      '--seed',
      '7',
      '--out',
      './sample-out.json',
    ],
    { encoding: 'utf8', cwd: __dirname }
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log('✓ Wrote sample-out.json');
}

sample().catch((error) => {
  console.error('Sample failed:', error);
  process.exit(1);
});
