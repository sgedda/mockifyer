import {
  initMockifyerForDashboardProxy,
  initMockifyerForLocalFilesystem,
} from '@sgedda/mockifyer-fetch';

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
 * Initializes Mockifyer on the Node server. Controlled by env (see package.json scripts).
 *
 * | MOCKIFYER_RUNTIME | Behavior |
 * |-------------------|----------|
 * | `off` | Server `fetch` not patched |
 * | `filesystem` | Local JSON under mock-data; `MOCKIFYER_RECORD` toggles record |
 * | `proxy` | Dashboard `/api/proxy` when Redis healthy; falls back per preset |
 */
export async function initializeMockifyerOnServer(): Promise<void> {
  const mode = (process.env[MOCKIFYER_RUNTIME_KEY] ?? 'filesystem').toLowerCase();
  const record = process.env.MOCKIFYER_RECORD === 'true';
  const mockDataPath = readMockDataPath();

  if (mode === 'off') {
    console.log('[Mockifyer] MOCKIFYER_RUNTIME=off — server fetch is not patched');
    return;
  }

  if (mode === 'proxy') {
    const dashboardBaseUrl = (
      process.env.MOCKIFYER_PROXY_URL ?? 'http://localhost:3002'
    ).trim();

    await initMockifyerForDashboardProxy({
      dashboardBaseUrl,
      mockDataPath,
      recordOnMiss: record,
      useGlobalFetch: true,
      config: {
        recordMode: record,
        logging: 'info',
        initLog: {
          headline: '[Mockifyer] Next.js · dashboard proxy preset',
        },
      },
    });
    console.log('[Mockifyer] Dashboard proxy preset ready:', dashboardBaseUrl);
    return;
  }

  if (mode !== 'filesystem') {
    console.warn(
      `[Mockifyer] Unknown MOCKIFYER_RUNTIME="${mode}", using filesystem preset`
    );
  }

  initMockifyerForLocalFilesystem({
    mockDataPath,
    recordMode: record,
    useGlobalFetch: true,
    config: {
      logging: 'info',
      initLog: {
        headline: '[Mockifyer] Next.js · local filesystem preset',
      },
    },
  });

  console.log(
    `[Mockifyer] Filesystem preset · record=${String(record)} · path=${mockDataPath}`
  );
}
