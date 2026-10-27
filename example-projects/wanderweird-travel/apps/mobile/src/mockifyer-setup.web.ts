/**
 * Web demo: now that Metro bundling is fixed (.web.ts variants), initialize Mockifyer.
 * Uses dashboard proxy mode (redis backend) with fetch interceptor.
 * Imports from react-native entry (same as native setup).
 */
import { 
  initMockifyerForReactNativeDashboard,
  type SetupMockifyerForReactNativeResult 
} from '@sgedda/mockifyer-fetch/react-native';
import {
  resolveDashboardBaseUrl,
  resolveDefaultClientId,
  type MockifyerBackend,
} from './dev/mockifyer-env';

// Default excluded URLs (same as native setup)
const DEFAULT_EXCLUDED_URLS = [
  '/mockifyer',
  '/mockifyer-trace',
  '/assets',
  '/api/react-native',
];

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
  
  // Web uses dashboard proxy (same as native redis backend)
  const result = await initMockifyerForReactNativeDashboard({
    isDev: __DEV__,
    mockDataPath: 'mock-data',
    bundledDataPath: './assets/mock-data',
    dashboardBaseUrl,
    recordMode: false,
    config: {
      clientId,
      logging: __DEV__ ? 'info' : undefined,
      databaseProvider: { type: 'memory' },
      excludedUrls: [
        ...DEFAULT_EXCLUDED_URLS,
        '/api/scenario-config',
        '/api/client-lanes',
        '/api/date-config',
      ],
    },
  });
  
  return {
    result,
    backend: 'redis',
    dashboardBaseUrl,
    clientId,
  };
}
