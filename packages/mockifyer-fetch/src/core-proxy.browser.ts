/**
 * Browser stub for core-proxy - proxy functionality requires Node.js
 */

export function applyProxyRecordOnMissEnv(config: any): any {
  return config;
}

export function mirrorProxyRecordingToClient(): void {
  // Browser: no-op
}

export function performDashboardProxyRequest(): Promise<never> {
  return Promise.reject(new Error(
    '[Mockifyer Browser] Dashboard proxy requires Node.js. ' +
    'Use databaseProvider: { type: "memory", options: { fixtures: [...] } } for browser builds.'
  ));
}

export function initMockifyerForDashboardProxy(): Promise<never> {
  return Promise.reject(new Error('[Mockifyer Browser] Dashboard proxy requires Node.js'));
}

export function initMockifyerForLocalFilesystem(): never {
  throw new Error('[Mockifyer Browser] Use setupMockifyer from browser entry');
}

export function initMockifyerForDashboardProxyClients(): Promise<never> {
  return Promise.reject(new Error('[Mockifyer Browser] Dashboard proxy requires Node.js'));
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
