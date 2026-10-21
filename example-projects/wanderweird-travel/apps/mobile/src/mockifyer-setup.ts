import {
  DEFAULT_EXCLUDED_URLS,
  type MockifyerRuntimeMode,
} from '@sgedda/mockifyer-core';
import {
  initMockifyerForReactNativeDashboard,
  setupMockifyerForReactNative,
  type SetupMockifyerForReactNativeResult,
} from '@sgedda/mockifyer-fetch/react-native';
import {
  resolveBackend,
  resolveDashboardBaseUrl,
  resolveDefaultClientId,
  readEnv,
  type MockifyerBackend,
} from './dev/mockifyer-env';
import {
  applyRecordBodiesToInstance,
  applyRecordModeToInstance,
  loadRecordBodiesPreference,
  loadRecordModePreference,
} from './dev/recording-preferences';

function resolveRecordMode(): boolean {
  if (!__DEV__) {
    return false;
  }
  return (
    readEnv('EXPO_PUBLIC_MOCKIFYER_RECORD') === 'true' ||
    readEnv('MOCKIFYER_RECORD') === 'true'
  );
}

function resolveRuntimeMode(): MockifyerRuntimeMode | undefined {
  const raw = (readEnv('EXPO_PUBLIC_MOCKIFYER_MODE') ?? readEnv('MOCKIFYER_MODE'))?.toLowerCase();
  if (!raw) {
    return undefined;
  }
  if (raw === 'off' || raw === 'disabled') {
    return 'off';
  }
  if (raw === 'on' || raw === 'enabled') {
    return 'on';
  }
  if (raw === 'launch_client' || raw === 'e2e' || raw === 'maestro') {
    return 'launch_client';
  }
  if (raw === 'manual' || raw === 'gui' || raw === 'toggle') {
    return 'manual';
  }
  return undefined;
}

export interface WanderweirdMockifyerBoot {
  result: SetupMockifyerForReactNativeResult;
  backend: MockifyerBackend;
  dashboardBaseUrl: string;
  clientId: string;
}

/**
 * Initialize Mockifyer early in the Expo app lifecycle.
 * Hybrid syncs with monorepo `mock-data/` via Metro; redis uses dashboard proxy.
 */
export async function initializeMockifyer(): Promise<WanderweirdMockifyerBoot> {
  const backend = resolveBackend();
  const recordMode = resolveRecordMode();
  const runtimeMode = resolveRuntimeMode();
  const dashboardBaseUrl = resolveDashboardBaseUrl();
  const clientId = resolveDefaultClientId();

  const sharedConfig = {
    logging: __DEV__ ? ('info' as const) : undefined,
    clientId,
    /** Dev-menu / dashboard control-plane paths must never be recorded. */
    excludedUrls: [
      ...DEFAULT_EXCLUDED_URLS,
      '/api/scenario-config',
      '/api/client-lanes',
      '/api/date-config',
    ],
  };

  if (backend === 'redis') {
    const result = await initMockifyerForReactNativeDashboard({
      isDev: __DEV__,
      mockDataPath: 'mock-data',
      bundledDataPath: './assets/mock-data',
      dashboardBaseUrl,
      recordMode,
      runtimeMode,
      config: {
        ...sharedConfig,
        databaseProvider: { type: 'memory' },
      },
    });
    await restorePersistedRecordMode(result.instance, recordMode);
    return { result, backend, dashboardBaseUrl, clientId };
  }

  const result = await setupMockifyerForReactNative({
    isDev: __DEV__,
    mockDataPath: 'mock-data',
    bundledDataPath: './assets/mock-data',
    recordMode,
    runtimeMode,
    config: sharedConfig,
  });

  await restorePersistedRecordMode(result.instance, recordMode);
  return { result, backend, dashboardBaseUrl, clientId };
}

async function restorePersistedRecordMode(
  instance: WanderweirdMockifyerBoot['result']['instance'],
  envRecordMode: boolean
): Promise<void> {
  if (!instance || !__DEV__) {
    return;
  }
  // Env wins when explicitly recording; otherwise restore last dev-menu choice.
  const preferred = envRecordMode || (await loadRecordModePreference());
  applyRecordModeToInstance(instance, preferred);
  applyRecordBodiesToInstance(instance, await loadRecordBodiesPreference());
}
