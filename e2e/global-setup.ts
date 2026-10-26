import { DASHBOARD, GATEWAY, APP } from './lib/env';

// Fail fast with a clear message when the stack is not running.
export default async function globalSetup() {
  for (const [name, url] of [['dashboard', `${DASHBOARD}/api/scenario-config`], ['gateway', `${GATEWAY}/api/discover?destinationKey=atlantis`], ['app (Metro web)', APP]]) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      throw new Error(`${name} not reachable at ${url} (${(e as Error).message}). Start the WanderWeird demo stack first, see README.`);
    }
  }
}
