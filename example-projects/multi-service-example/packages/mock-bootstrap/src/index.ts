import {
  initMockifyerForDashboardProxy,
  initMockifyerForLocalFilesystem,
} from '@sgedda/mockifyer-fetch';
export { createMockifyerCorrelationMiddleware } from '@sgedda/mockifyer-core';

/**
 * Shared bootstrap for Node services (`tsx`). The Next.js app duplicates this logic in
 * `apps/web/lib/mockifyer-server-init.ts` because Turbopack cannot resolve `@sgedda/mockifyer-fetch`
 * through this workspace package — keep both files aligned when changing behavior.
 */
const MOCKIFYER_RUNTIME_KEY = 'MOCKIFYER_RUNTIME';

function readMockDataPath(): string {
  const env = process.env.MOCKIFYER_PATH?.trim();
  const cwd = process.cwd();
  if (env) {
    if (env.startsWith('/') || /^[A-Za-z]:[\\/]/.test(env)) {
      return env;
    }
    const trimmed = env.replace(/^\.\//, '');
    return `${cwd}/${trimmed}`;
  }
  return `${cwd}/mock-data`;
}

/**
 * Shared Mockifyer bootstrap for the multi-service example.
 * Use the same `MOCKIFYER_CLIENT_ID` and `MOCKIFYER_PATH` in every process so they share one lane + scenario root.
 *
 * | MOCKIFYER_RUNTIME | Behavior |
 * |-------------------|----------|
 * | `off` | `fetch` not patched |
 * | `filesystem` | JSON mocks under MOCKIFYER_PATH |
 * | `proxy` | Dashboard `/api/proxy` when Redis is healthy |
 *
 * Recording: set **`MOCKIFYER_RECORD=true`** in this process (`false` by default in dev scripts).
 */
export async function initializeMockifyerFromEnv(options: { label: string }): Promise<void> {
  const mode = (process.env[MOCKIFYER_RUNTIME_KEY] ?? 'filesystem').toLowerCase();
  const record = process.env.MOCKIFYER_RECORD === 'true';
  const mockDataPath = readMockDataPath();
  const clientId = process.env.MOCKIFYER_CLIENT_ID?.trim() || undefined;

  if (mode === 'off') {
    console.log(`[Mockifyer] ${options.label}: MOCKIFYER_RUNTIME=off — fetch is not patched`);
    return;
  }

  if (mode === 'proxy') {
    const dashboardBaseUrl = (
      process.env.MOCKIFYER_PROXY_URL ?? 'http://127.0.0.1:3002'
    ).trim();

    await initMockifyerForDashboardProxy({
      dashboardBaseUrl,
      mockDataPath,
      recordOnMiss: record,
      useGlobalFetch: true,
      clientId,
      config: {
        recordMode: record,
        clientId,
        logging: 'info',
        initLog: {
          headline: `[Mockifyer] ${options.label} · dashboard proxy`,
        },
      },
    });
    console.log(`[Mockifyer] ${options.label}: dashboard proxy ready (${dashboardBaseUrl})`);
    return;
  }

  if (mode !== 'filesystem') {
    console.warn(
      `[Mockifyer] ${options.label}: unknown MOCKIFYER_RUNTIME="${mode}", using filesystem preset`
    );
  }

  initMockifyerForLocalFilesystem({
    mockDataPath,
    recordMode: record,
    useGlobalFetch: true,
    config: {
      clientId,
      logging: 'info',
      initLog: {
        headline: `[Mockifyer] ${options.label} · filesystem`,
      },
    },
  });

  console.log(
    `[Mockifyer] ${options.label}: filesystem · record=${String(record)} · path=${mockDataPath}` +
      (clientId ? ` · clientId=${clientId}` : '')
  );
}
