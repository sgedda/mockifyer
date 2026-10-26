/**
 * Web demo: skip Mockifyer. Metro cannot bundle core's dynamic `require(packageName)`.
 * Native still uses `mockifyer-setup.ts` (Hybrid / dashboard proxy).
 */
import type { SetupMockifyerForReactNativeResult } from '@sgedda/mockifyer-fetch/react-native';
import {
  resolveDashboardBaseUrl,
  resolveDefaultClientId,
  type MockifyerBackend,
} from './dev/mockifyer-env';

export interface WanderweirdMockifyerBoot {
  result: SetupMockifyerForReactNativeResult;
  backend: MockifyerBackend;
  dashboardBaseUrl: string;
  clientId: string;
}

export async function initializeMockifyer(): Promise<WanderweirdMockifyerBoot> {
  console.info('[Wanderweird] Mockifyer skipped on web — talking straight to gateway APIs');
  return {
    result: { status: 'not_activated', instance: null },
    backend: 'hybrid',
    dashboardBaseUrl: resolveDashboardBaseUrl(),
    clientId: resolveDefaultClientId(),
  };
}
