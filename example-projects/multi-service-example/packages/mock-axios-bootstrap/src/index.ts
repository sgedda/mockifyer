import type { AxiosInstance } from 'axios';
import { setupMockifyer } from '@sgedda/mockifyer-axios';
export { createMockifyerCorrelationMiddleware } from '@sgedda/mockifyer-core';

/**
 * Axios + Mockifyer bootstrap for Node examples (`tsx`).
 * `mockifyer-axios` does not expose dashboard-proxy presets like `@sgedda/mockifyer-fetch`; only
 * **`filesystem`** and **`off`** are supported here. **`proxy`** falls back to filesystem with a warning.
 *
 * **`axiosInstance`**: In ESM (`"type": "module"`), pass the same object as `import axios from 'axios'`.
 * Otherwise `setupMockifyer` may patch `require('axios')` while your code calls a different default
 * export — interceptors (and **recording**) never run on real requests.
 *
 * Keep env parity with `@multi-service/mock-bootstrap` (`MOCKIFYER_PATH`, `MOCKIFYER_CLIENT_ID`,
 * `MOCKIFYER_RECORD`, `MOCKIFYER_RUNTIME`).
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

export function initializeMockifyerAxiosFromEnv(options: {
  label: string;
  /** Same reference your routes use (`import axios from 'axios'`) — required for ESM relay recording */
  axiosInstance: AxiosInstance;
}): void {
  const mode = (process.env[MOCKIFYER_RUNTIME_KEY] ?? 'filesystem').toLowerCase();
  const record = process.env.MOCKIFYER_RECORD === 'true';
  const mockDataPath = readMockDataPath();
  const clientId = process.env.MOCKIFYER_CLIENT_ID?.trim() || undefined;

  if (mode === 'off') {
    console.log(`[Mockifyer] ${options.label}: MOCKIFYER_RUNTIME=off — axios is not patched`);
    return;
  }

  if (mode === 'proxy') {
    console.warn(
      `[Mockifyer] ${options.label}: MOCKIFYER_RUNTIME=proxy is not supported for mockifyer-axios in this example; using filesystem`
    );
  } else if (mode !== 'filesystem') {
    console.warn(
      `[Mockifyer] ${options.label}: unknown MOCKIFYER_RUNTIME="${mode}", using filesystem preset`
    );
  }

  setupMockifyer({
    mockDataPath,
    recordMode: record,
    /** Always hit the network while recording so fetch-created mocks for the same URL do not short-circuit axios */
    recordSameEndpoints: record,
    useGlobalAxios: true,
    axiosInstance: options.axiosInstance,
    clientId,
    logging: 'info',
    initLog: {
      headline: `[Mockifyer] ${options.label} · axios · filesystem`,
    },
  });

  console.log(
    `[Mockifyer] ${options.label}: axios filesystem · record=${String(record)} · path=${mockDataPath}` +
      (clientId ? ` · clientId=${clientId}` : '')
  );
}
