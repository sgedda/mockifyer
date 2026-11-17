/**
 * Global setup - runs once before all tests
 * Creates test scenarios and mocks on-demand
 */

import { ensureTestData } from './lib/setup';

const VERIFY_ATTEMPTS = 4;
const VERIFY_ATTEMPT_TIMEOUT_MS = 10_000;
/** Short backoff between failed probe attempts (not a readiness sleep). */
const VERIFY_BACKOFF_MS = 500;

const ATHENS_DISCOVER_URL = 'http://127.0.0.1:4203/discover?destinationKey=atlantis';

interface ProbeOutcome {
  ok: boolean;
  detail: string;
}

/**
 * Run a verify probe up to VERIFY_ATTEMPTS times with per-attempt logging.
 * Returns whether it eventually passed and a history line per attempt for the final error.
 */
async function verifyWithRetries(
  name: string,
  url: string,
  probe: (signal: AbortSignal) => Promise<ProbeOutcome>
): Promise<{ ok: boolean; history: string[] }> {
  const history: string[] = [];

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++) {
    const attemptStarted = Date.now();
    console.log(`[Verify] ${name} attempt ${attempt}/${VERIFY_ATTEMPTS} ${url}`);
    try {
      const outcome = await probe(AbortSignal.timeout(VERIFY_ATTEMPT_TIMEOUT_MS));
      const elapsedMs = Date.now() - attemptStarted;
      if (outcome.ok) {
        console.log(`[Verify] ✓ ${name} attempt ${attempt}: ${outcome.detail} (${elapsedMs}ms)`);
        history.push(`attempt ${attempt}: ok ${outcome.detail} ${elapsedMs}ms`);
        return { ok: true, history };
      }
      console.log(`[Verify] ✗ ${name} attempt ${attempt}: ${outcome.detail} (${elapsedMs}ms)`);
      history.push(`attempt ${attempt}: ${outcome.detail} ${elapsedMs}ms`);
    } catch (err: unknown) {
      const elapsedMs = Date.now() - attemptStarted;
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[Verify] ✗ ${name} attempt ${attempt}: ${message} (${elapsedMs}ms)`);
      history.push(`attempt ${attempt}: error ${message} ${elapsedMs}ms`);
    }

    if (attempt < VERIFY_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, VERIFY_BACKOFF_MS));
    }
  }

  return { ok: false, history };
}

async function verifyService(name: string, url: string): Promise<{ ok: boolean; history: string[] }> {
  return verifyWithRetries(name, url, async (signal) => {
    const res = await fetch(url, { signal });
    if (res.ok) {
      return { ok: true, detail: `status ${res.status}` };
    }
    return { ok: false, detail: `status ${res.status}` };
  });
}

async function verifyAthensMock(): Promise<{ ok: boolean; history: string[] }> {
  return verifyWithRetries('Athens mock', ATHENS_DISCOVER_URL, async (signal) => {
    const res = await fetch(ATHENS_DISCOVER_URL, {
      headers: { 'X-Mockifyer-Client-Id': 'wanderweird-demo' },
      signal,
    });
    if (!res.ok) {
      return { ok: false, detail: `status ${res.status}` };
    }
    const data = await res.json();
    const temp = data?.weather?.current?.temperature_2m;
    if (temp === 99) {
      return { ok: true, detail: 'temperature 99°' };
    }
    const source = data?.weather?.source || 'unknown';
    return { ok: false, detail: `temperature ${temp}, expected 99° (source: ${source})` };
  });
}

export default async function globalSetup() {
  console.log('\n=== E2E Global Setup ===\n');

  const success = await ensureTestData();

  if (!success) {
    throw new Error('Test data setup failed - see errors above');
  }

  console.log('\n[Verify] Checking services...\n');

  const checks = await Promise.all([
    verifyService('Dashboard', 'http://127.0.0.1:3002/api/health'),
    verifyService('Gateway', 'http://127.0.0.1:4200/health'),
    verifyService('Wander-api', 'http://127.0.0.1:4203/health'),
    verifyService('Metro', 'http://127.0.0.1:8090'),
    verifyAthensMock(),
  ]);

  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    const historyBlock = checks
      .map((c, i) => {
        const labels = ['Dashboard', 'Gateway', 'Wander-api', 'Metro', 'Athens mock'];
        return `${labels[i]}: ${c.history.join('; ')}`;
      })
      .join('\n');
    throw new Error(
      `Service verification failed - one or more services not responding or mock not working\n${historyBlock}`
    );
  }

  console.log('\n✓ All services verified and mocks working\n');
}
