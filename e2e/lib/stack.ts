import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect } from '@playwright/test';
import { dashboard, gatewayTemp } from './dashboard';
import { BASE_SCENARIO, EXPECTED_TEMP, GATEWAY, SCRATCH_DASHBOARD } from './env';

const SCRIPTS = path.resolve(__dirname, '../scripts');
const SCRIPT_TIMEOUT_MS = 90_000;
// A healthy attempt takes < 1 s in CI. After a restart some attempts hang with no slow hop
// in the dashboard log, and a fresh attempt then succeeds, so abort early and retry.
const GATEWAY_ATTEMPT_TIMEOUT_MS = 3_000;
const GATEWAY_POLL_INTERVAL_MS = 1_000;

function seconds(sinceMs: number): string {
  return `${((Date.now() - sinceMs) / 1000).toFixed(1)}s`;
}

/** Run one of e2e/scripts with extra env and log what it printed. */
function run(script: string, args: string[], env: Record<string, string> = {}) {
  const started = Date.now();
  const out = execFileSync(path.join(SCRIPTS, script), args, {
    encoding: 'utf8',
    timeout: SCRIPT_TIMEOUT_MS,
    env: { ...process.env, WW: process.env.WW || 'example-projects/wanderweird-travel', ...env },
  }).trim();
  console.log(`[stack] ${script} ${args.join(' ')} took ${seconds(started)}: ${out.replace(/\n/g, ' | ')}`);
  return out;
}
export const wander = {
  stop: () => run('wander.sh', ['stop']),
  /** Unpinned: wander-api follows the client lane. */
  followLane: () => run('wander.sh', ['start']),
  /** Pinned to a scenario, which is how the demo stack normally runs it. */
  pin: (scenario = BASE_SCENARIO) => run('wander.sh', ['start', scenario]),
};

/**
 * The from-scratch GUI test's own stack: an empty dashboard on SCRATCH_DASHBOARD, with the gateway and
 * wander-api proxying through it (unpinned, without the record env, so only the dashboard's Record switch
 * and its rules decide what is stored). The app and the rest of the services keep using the demo dashboard.
 */
export const scratchStack = {
  async start() {
    run('scratch-dashboard.sh', ['start']);
    const viaScratch = { MOCKIFYER_DASHBOARD_URL: SCRATCH_DASHBOARD, WW_RECORD: 'off' };
    run('ww-service.sh', ['wander-api', 'start'], viaScratch);
    run('ww-service.sh', ['gateway-api', 'start'], viaScratch);
    // Not waitForGateway(): a discover call without a clientId would resolve to the scratch dashboard's
    // global scenario and store placeholders there before the test starts.
    await expect.poll(async () => (await fetch(`${GATEWAY}/health`).catch(() => undefined))?.status, { timeout: 30_000 }).toBe(200);
  },
  /** Back to the demo stack: gateway as `dev:proxy:record` starts it, wander-api pinned to the base scenario. */
  async stop() {
    run('ww-service.sh', ['gateway-api', 'start']);
    run('scratch-dashboard.sh', ['stop']);
    await pinToBaseAndWait();
  },
};

/** Restart wander-api unpinned, so client lane switches reach the app, and wait until it serves. */
export async function followLaneAndWait() {
  wander.followLane();
  await waitForGateway();
}

/** Pin wander-api back to the base scenario (how the demo stack normally runs) and wait for its value. */
export async function pinToBaseAndWait() {
  wander.pin(BASE_SCENARIO);
  await waitForGateway();
  await expect.poll(gatewayTemp, { timeout: 30_000 }).toBe(EXPECTED_TEMP[BASE_SCENARIO]);
}

const SLOW_HOP_MS = 2_000;
const DEMO_SCENARIOS = Object.keys(EXPECTED_TEMP);

/** Dashboard hops since `sinceMs` that were slow or failed, to explain a missed gateway attempt. */
async function slowHopsSince(sinceMs: number): Promise<string> {
  const since = new Date(sinceMs).toISOString();
  const lines: string[] = [];
  for (const scenario of DEMO_SCENARIOS) {
    const r = await dashboard.call(
      'GET',
      `/network-events?scenario=${encodeURIComponent(scenario)}&since=${encodeURIComponent(since)}&limit=200`
    );
    for (const e of r.json?.events ?? []) {
      if ((e.durationMs ?? 0) < SLOW_HOP_MS && e.source !== 'error') continue;
      lines.push(`${scenario} ${e.source} ${e.status} ${e.durationMs}ms ${String(e.url).slice(0, 100)}`);
    }
  }
  return lines.length ? lines.join(' ; ') : 'none';
}

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
        if (misses.length) console.log(`[stack] slow or failed hops: ${await slowHopsSince(started)}`);
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
