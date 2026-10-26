/**
 * Web demo: now that Metro bundling is fixed (.web.ts variants), initialize Mockifyer.
 * Uses dashboard proxy mode (redis backend) with fetch interceptor.
 */
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import type { SetupMockifyerForReactNativeResult } from '@sgedda/mockifyer-fetch/react-native';
import {
  resolveDashboardBaseUrl,
  resolveDefaultClientId,
  type MockifyerBackend,
} from './dev/mockifyer-env';
import { DEFAULT_EXCLUDED_URLS } from './mockifyer-setup';

export interface WanderweirdMockifyerBoot {
  result: SetupMockifyerForReactNativeResult;
  backend: MockifyerBackend;
  dashboardBaseUrl: string;
  clientId: string;
}

export async function initializeMockifyer(): Promise<WanderweirdMockifyerBoot> {
  const dashboardBaseUrl = resolveDashboardBaseUrl();
  const clientId = resolveDefaultClientId();
  
  console.info('[Wanderweird Web] Initializing Mockifyer with dashboard proxy');
  console.info(`[Wanderweird Web] Client ID: ${clientId}`);
  console.info(`[Wanderweird Web] Dashboard: ${dashboardBaseUrl}`);
  
  // Web uses fetch interceptor with dashboard proxy (redis backend)
  const instance = setupMockifyer({
    mockDataPath: 'mock-data',
    recordMode: false,
    clientId,
    logging: __DEV__ ? 'info' : undefined,
    proxy: {
      baseUrl: dashboardBaseUrl,
      recordOnMiss: false,
      strictLaneScenario: true,
    },
    excludedUrls: [
      ...DEFAULT_EXCLUDED_URLS,
      '/api/scenario-config',
      '/api/client-lanes',
      '/api/date-config',
    ],
  });
  
  return {
    result: { status: 'activated', instance },
    backend: 'redis',
    dashboardBaseUrl,
    clientId,
  };
}
