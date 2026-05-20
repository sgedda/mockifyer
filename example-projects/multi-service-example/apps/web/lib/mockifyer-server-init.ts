import {
  initMockifyerForDashboardProxy,
  initMockifyerForLocalFilesystem,
} from '../../../../../packages/mockifyer-fetch';

/**
 * Mirrors `packages/mock-bootstrap/src/index.ts`. Turbopack does not resolve hoisted
 * `node_modules/@sgedda/mockifyer-fetch` from this app, so we import the monorepo package by path;
 * keep both files aligned when changing bootstrap behavior.
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
 * Initializes Mockifyer on the Next.js Node server. Controlled by env (see package.json scripts).
 *
 * | MOCKIFYER_RUNTIME | Behavior |
 * |-------------------|----------|
 * | `off` | Server `fetch` not patched |
 * | `filesystem` | Local JSON under mock-data |
 * | `proxy` | Dashboard `/api/proxy` when Redis healthy |
 *
 * Recording: **`MOCKIFYER_RECORD=true`** (see `dev` / `dev:record` in package.json).
 */
export async function initializeMockifyerOnServer(): Promise<void> {
  const mode = (process.env[MOCKIFYER_RUNTIME_KEY] ?? 'filesystem').toLowerCase();
  const record = process.env.MOCKIFYER_RECORD === 'true';
  const mockDataPath = readMockDataPath();
  const clientId = process.env.MOCKIFYER_CLIENT_ID?.trim() || undefined;
  const label = 'web (Next.js)';

  if (mode === 'off') {
    console.log(`[Mockifyer] ${label}: MOCKIFYER_RUNTIME=off — fetch is not patched`);
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
      strictLaneScenario: false,
      useGlobalFetch: true,
      clientId,
      config: {
        recordMode: record,
        clientId,
        logging: 'info',
        initLog: {
          headline: `[Mockifyer] ${label} · dashboard proxy`,
        },
      },
    });
    console.log(`[Mockifyer] ${label}: dashboard proxy ready (${dashboardBaseUrl})`);
    return;
  }

  if (mode !== 'filesystem') {
    console.warn(
      `[Mockifyer] ${label}: unknown MOCKIFYER_RUNTIME="${mode}", using filesystem preset`
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
        headline: `[Mockifyer] ${label} · filesystem`,
      },
    },
  });

  console.log(
    `[Mockifyer] ${label}: filesystem · record=${String(record)} · path=${mockDataPath}` +
      (clientId ? ` · clientId=${clientId}` : '')
  );
}
