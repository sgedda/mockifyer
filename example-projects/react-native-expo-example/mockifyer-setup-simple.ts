/**
 * Mockifyer setup for React Native Expo (recommended helper).
 *
 * Backend is selected with **EXPO_PUBLIC_MOCKIFYER_*** env vars inlined at bundle time
 * (set them on the `expo start` command — see `package.json` scripts).
 *
 * | Mode | EXPO_PUBLIC_MOCKIFYER_BACKEND | Dashboard |
 * |------|--------------------------------|-----------|
 * | Hybrid (Metro + device mocks) | `hybrid` (default) | Optional filesystem UI only |
 * | Redis proxy | `redis` | **`npm run dashboard:redis`** on host |
 */

import {
  initMockifyerForReactNativeDashboard,
  setupMockifyerForReactNative,
  type SetupMockifyerForReactNativeResult,
} from '@sgedda/mockifyer-fetch/react-native';
import type { MockifyerRuntimeMode } from '@sgedda/mockifyer-core';
import { Platform } from 'react-native';

function readEnv(key: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) {
    return undefined;
  }
  const v = process.env[key];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

/** Android emulator → host; iOS simulator → localhost */
function defaultDashboardOrigin(): string {
  return Platform.OS === 'android' ? 'http://10.0.2.2:3002' : 'http://localhost:3002';
}

function resolveBackend(): 'hybrid' | 'redis' {
  const raw = readEnv('EXPO_PUBLIC_MOCKIFYER_BACKEND')?.toLowerCase();
  if (raw === 'redis' || raw === 'proxy' || raw === 'dashboard') {
    return 'redis';
  }
  return 'hybrid';
}

function resolveProxyBaseUrl(): string {
  return readEnv('EXPO_PUBLIC_MOCKIFYER_PROXY_URL') ?? defaultDashboardOrigin();
}

function resolveRecordMode(): boolean {
  if (!__DEV__) {
    return false;
  }
  const a = readEnv('EXPO_PUBLIC_MOCKIFYER_RECORD');
  const b = readEnv('MOCKIFYER_RECORD');
  return a === 'true' || b === 'true';
}

/**
 * Optional explicit proxy `record` flag. When undefined, RN uses `proxyRecordOnMiss ?? recordMode`.
 * Set EXPO_PUBLIC_MOCKIFYER_PROXY_RECORD_ON_MISS=true|false to override.
 */
function resolveProxyRecordOnMiss(): boolean | undefined {
  const raw = readEnv('EXPO_PUBLIC_MOCKIFYER_PROXY_RECORD_ON_MISS')?.toLowerCase();
  if (raw === 'true' || raw === '1') {
    return true;
  }
  if (raw === 'false' || raw === '0') {
    return false;
  }
  return undefined;
}

function resolveProxyRecordResponses(): boolean | undefined {
  const a = readEnv('EXPO_PUBLIC_MOCKIFYER_RECORD_RESPONSES');
  const b = readEnv('MOCKIFYER_RECORD_RESPONSES');
  const raw = (a ?? b)?.toLowerCase();
  if (raw === 'true' || raw === '1') {
    return true;
  }
  if (raw === 'false' || raw === '0') {
    return false;
  }
  return undefined;
}

function resolveRuntimeMode(): MockifyerRuntimeMode | undefined {
  const fromPublic = readEnv('EXPO_PUBLIC_MOCKIFYER_MODE');
  const fromPlain = readEnv('MOCKIFYER_MODE');
  const raw = (fromPublic ?? fromPlain)?.toLowerCase();
  if (!raw) {
    return undefined;
  }
  if (raw === 'off' || raw === 'disabled' || raw === 'none') {
    return 'off';
  }
  if (raw === 'on' || raw === 'enabled' || raw === 'always') {
    return 'on';
  }
  if (raw === 'launch_client' || raw === 'launch-client' || raw === 'e2e' || raw === 'maestro') {
    return 'launch_client';
  }
  return undefined;
}

function resolveGenerateTestsEnabled(): boolean {
  const a = readEnv('EXPO_PUBLIC_MOCKIFYER_GENERATE_TESTS');
  const b = readEnv('MOCKIFYER_GENERATE_TESTS');
  return a === 'true' || b === 'true';
}

function devSharedConfig(): Record<string, unknown> {
  const out: Record<string, unknown> = {
    logging: 'info',
  };
  if (resolveGenerateTestsEnabled()) {
    out.generateTests = {
      enabled: true,
      framework: 'jest',
      outputPath: './tests/generated',
      groupBy: 'endpoint',
    };
  }
  return out;
}

/**
 * Initialize Mockifyer for Expo.
 *
 * - **Hybrid:** device + project mock-data via Metro (no Redis required).
 * - **Redis:** traffic goes through dashboard **`/api/proxy`**; run `npm run dashboard:redis` first.
 */
export async function initializeMockifyer(): Promise<SetupMockifyerForReactNativeResult> {
  const backend = resolveBackend();
  const recordMode = resolveRecordMode();
  const runtimeMode = resolveRuntimeMode();
  const proxyRecordOnMiss = resolveProxyRecordOnMiss();
  const proxyRecordResponses = resolveProxyRecordResponses();

  if (backend === 'redis') {
    return initMockifyerForReactNativeDashboard({
      isDev: __DEV__,
      mockDataPath: 'mock-data',
      bundledDataPath: './assets/mock-data',
      dashboardBaseUrl: resolveProxyBaseUrl(),
      recordMode,
      proxyRecordOnMiss,
      proxyRecordResponses,
      runtimeMode,
      config: __DEV__ ? { ...devSharedConfig(), databaseProvider: { type: 'memory' } } : {},
    });
  }

  return setupMockifyerForReactNative({
    isDev: __DEV__,
    mockDataPath: 'mock-data',
    bundledDataPath: './assets/mock-data',
    recordMode,
    runtimeMode,
    proxyRecordOnMiss,
    proxyRecordResponses,
    config: __DEV__ ? devSharedConfig() : {},
  });
}
