/**
 * Default StackBlitz startCommand: replay committed mocks, then try generate.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveGenerator, GENERATOR_PUBLISH_HINT } from './generator-resolve.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run(script) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    encoding: 'utf8',
    cwd: __dirname,
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

async function start() {
  console.log('=== Mockifyer StackBlitz: record → replay → generate ===\n');
  console.log('On open: replay (offline). Record/generate are available via npm scripts.\n');

  const replayStatus = run('replay.js');
  if (replayStatus !== 0) {
    process.exit(replayStatus);
  }

  console.log('\n=== generate (optional) ===\n');
  const resolved = await resolveGenerator();
  if (!resolved?.cliPath) {
    console.log(GENERATOR_PUBLISH_HINT);
    console.log('\n✓ Replay OK. Record/generate when ready: npm run record | npm run generate');
    return;
  }

  const generateStatus = run('generate.js');
  if (generateStatus !== 0) {
    process.exit(generateStatus);
  }

  console.log('\n✓ Demo complete. Try: npm run record  (needs network)');
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
