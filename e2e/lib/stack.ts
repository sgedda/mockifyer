import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { BASE_SCENARIO, GATEWAY } from './env';

const WANDER = path.resolve(__dirname, '../scripts/wander.sh');
const WANDER_SH_TIMEOUT_MS = 90_000;
const GATEWAY_ATTEMPT_TIMEOUT_MS = 10_000;
const GATEWAY_POLL_INTERVAL_MS = 1_000;

function seconds(sinceMs: number): string {
  return `${((Date.now() - sinceMs) / 1000).toFixed(1)}s`;
}

function run(...args: string[]) {
  const started = Date.now();
  const out = execFileSync(WANDER, args, {
    encoding: 'utf8',
    timeout: WANDER_SH_TIMEOUT_MS,
    env: { ...process.env, WW: process.env.WW || 'example-projects/wanderweird-travel' }
  }).trim();
  console.log(`[stack] wander.sh ${args.join(' ')} took ${seconds(started)}: ${out.replace(/\n/g, ' | ')}`);
  return out;
}
export const wander = {
  stop: () => run('stop'),
  /** Unpinned: wander-api follows the client lane. */
  followLane: () => run('start'),
  /** Pinned to a scenario, which is how the demo stack normally runs it. */
  pin: (scenario = BASE_SCENARIO) => run('start', scenario),
};

/** Wait until the gateway serves Atlantis with HTTP 200 (wander-api warm after a restart). */
export async function waitForGateway(timeoutMs = 60_000) {
  const started = Date.now();
  const end = started + timeoutMs;
  const misses: string[] = [];
  while (Date.now() < end) {
    const attemptStarted = Date.now();
    try {
      const r = await fetch(`${GATEWAY}/api/discover?destinationKey=atlantis`, {
        signal: AbortSignal.timeout(GATEWAY_ATTEMPT_TIMEOUT_MS),
      });
      if (r.status === 200) {
        console.log(`[stack] gateway 200 after ${seconds(started)}${misses.length ? ` (misses: ${misses.join(', ')})` : ''}`);
        return;
      }
      misses.push(`${r.status} in ${seconds(attemptStarted)}`);
    } catch (err) {
      misses.push(`${err instanceof Error ? err.name : 'error'} in ${seconds(attemptStarted)}`);
    }
    await new Promise((r) => setTimeout(r, GATEWAY_POLL_INTERVAL_MS));
  }
  throw new Error(`gateway did not return 200 for Atlantis in time (misses: ${misses.join(', ')})`);
}
