import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { BASE_SCENARIO, GATEWAY } from './env';

const WANDER = path.resolve(__dirname, '../scripts/wander.sh');

function run(...args: string[]) {
  return execFileSync(WANDER, args, { encoding: 'utf8', timeout: 90_000 }).trim();
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
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const r = await fetch(`${GATEWAY}/api/discover?destinationKey=atlantis`, { signal: AbortSignal.timeout(10_000) });
      if (r.status === 200) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('gateway did not return 200 for Atlantis in time');
}
