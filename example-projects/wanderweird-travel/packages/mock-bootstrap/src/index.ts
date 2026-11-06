import {
  initMockifyerForDashboardProxy,
  initMockifyerForLocalFilesystem,
} from '@sgedda/mockifyer-fetch';

export { createMockifyerCorrelationMiddleware } from '@sgedda/mockifyer-core';

const MOCKIFYER_RUNTIME_KEY = 'MOCKIFYER_RUNTIME';

type ActivationMode = 'always' | 'client_id_header' | 'off';

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

function readActivationMode(fallback: ActivationMode): ActivationMode {
  const raw = process.env.MOCKIFYER_ACTIVATION_MODE?.trim().toLowerCase();
  if (raw === 'always' || raw === 'client_id_header' || raw === 'off') {
    return raw;
  }
  return fallback;
}

/**
 * Whether proxy/filesystem recordings should store response bodies.
 * Default **false** — request-only stubs (`responsePending`) until you capture a body later.
 * Set `MOCKIFYER_RECORD_RESPONSES=true` for full bodies.
 */
function readRecordResponses(): boolean {
  const raw = process.env.MOCKIFYER_RECORD_RESPONSES?.trim().toLowerCase();
  if (raw === undefined || raw === '') {
    return false;
  }
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

/**
 * Shared Mockifyer bootstrap for Wanderweird Node services.
 * Use the same MOCKIFYER_CLIENT_ID + MOCKIFYER_PATH in every process.
 *
 * Preferred hop-recording modes (request stubs, client-id gate):
 * - Filesystem: `npm run dev:record:stubs` + `npm run dashboard`
 * - Proxy: `npm run dashboard:sqlite` + `npm run dev:proxy:record` (+ `lane:hello`)
 * - App: Mockifyer on with lane `wanderweird-demo` (Record bodies off)
 */
export async function initializeMockifyerFromEnv(options: { label: string }): Promise<void> {
  const mode = (process.env[MOCKIFYER_RUNTIME_KEY] ?? 'filesystem').toLowerCase();
  const recordEnv = process.env.MOCKIFYER_RECORD?.trim();
  const record = recordEnv === 'true';
  // Unset: leave recordOnMiss undefined so /api/proxy omits `record` and the dashboard's Record switch decides.
  const recordOnMiss = recordEnv ? record : undefined;
  const recordResponses = readRecordResponses();
  const mockDataPath = readMockDataPath();
  const clientId = process.env.MOCKIFYER_CLIENT_ID?.trim() || undefined;

  if (mode === 'off') {
    console.log(`[Mockifyer] ${options.label}: MOCKIFYER_RUNTIME=off — fetch is not patched`);
    return;
  }

  if (mode === 'proxy') {
    // Prefer 127.0.0.1 so health checks hit IPv4; pair with dashboard --host 0.0.0.0|127.0.0.1
    const dashboardBaseUrl = (
      process.env.MOCKIFYER_PROXY_URL ?? 'http://127.0.0.1:3002'
    ).trim();
    // Proxy workflows default to client-id gate so only trafficked lanes get stubs/hops.
    const activationMode = readActivationMode('client_id_header');

    await initMockifyerForDashboardProxy({
      dashboardBaseUrl,
      mockDataPath,
      recordOnMiss,
      recordResponses,
      useGlobalFetch: true,
      clientId,
      config: {
        recordMode: record,
        clientId,
        activationMode,
        logging: 'info',
        networkLog: {
          captureBodies: false,
        },
        proxy: {
          recordResponses,
        },
        initLog: {
          headline: `[Mockifyer] ${options.label} · dashboard proxy`,
        },
      },
    });
    console.log(
      `[Mockifyer] ${options.label}: dashboard proxy ready (${dashboardBaseUrl})` +
        ` · activation=${activationMode}` +
        ` · recordOnMiss=${recordOnMiss === undefined ? 'dashboard Record switch' : String(recordOnMiss)}` +
        ` · recordBodies=${String(recordResponses)}`
    );
    return;
  }

  if (mode !== 'filesystem') {
    console.warn(
      `[Mockifyer] ${options.label}: unknown MOCKIFYER_RUNTIME="${mode}", using filesystem preset`
    );
  }

  const activationMode = readActivationMode('always');

  initMockifyerForLocalFilesystem({
    mockDataPath,
    recordMode: record,
    useGlobalFetch: true,
    config: {
      clientId,
      activationMode,
      logging: 'info',
      networkLog: {
        captureBodies: false,
      },
      initLog: {
        headline: `[Mockifyer] ${options.label} · filesystem`,
      },
    },
  });

  console.log(
    `[Mockifyer] ${options.label}: filesystem · record=${String(record)}` +
      ` · recordBodies=${String(recordResponses)}` +
      ` · activation=${activationMode}` +
      ` · path=${mockDataPath}` +
      (clientId ? ` · clientId=${clientId}` : '')
  );
}
