/**
 * Browser implementation for core-proxy - exports browser-compatible dashboard proxy via fetch
 */

export function applyProxyRecordOnMissEnv(config: any): any {
  return config;
}

export function mirrorProxyRecordingToClient(): void {
  // Browser: no-op
}

// Export browser implementation of dashboard proxy (uses fetch instead of Node http)
export { performDashboardProxyRequest } from '@sgedda/mockifyer-core/utils/perform-dashboard-proxy-request';

export function initMockifyerForDashboardProxy(): Promise<never> {
  return Promise.reject(new Error(
    '[Mockifyer Browser] Use setupMockifyer from browser entry instead of initMockifyerForDashboardProxy'
  ));
}

export function initMockifyerForLocalFilesystem(): never {
  throw new Error('[Mockifyer Browser] Use setupMockifyer from browser entry');
}

export function initMockifyerForDashboardProxyClients(): Promise<never> {
  return Promise.reject(new Error(
    '[Mockifyer Browser] Use setupMockifyer from browser entry instead of initMockifyerForDashboardProxyClients'
  ));
}

export function initMockifyerForLocalFilesystemClients(): never {
  throw new Error('[Mockifyer Browser] Use setupMockifyer from browser entry');
}

export function resolveClientInitFlags(): any {
  return {};
}

export function needsSiblingClientSetup(): boolean {
  return false;
}

export function syncDualMockifyerControls(): void {
  // Browser: no-op
}

export function pickPrimaryDualMockifyerInstance(_transport: string, _flags: any, result: any): any {
  return result.fetch || result.axios;
}

export function loadAxiosSetupMockifyer(): null {
  return null;
}

export function loadFetchSetupMockifyer(): null {
  return null;
}

export type InitMockifyerForDashboardProxyOptions = any;
export type InitMockifyerForLocalFilesystemOptions = any;
export type DualMockifyerControlSurface = any;
