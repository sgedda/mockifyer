/**
 * Browser stub for core-proxy - proxy functionality requires Node.js
 */
export declare function applyProxyRecordOnMissEnv(config: any): any;
export declare function mirrorProxyRecordingToClient(): void;
export declare function performDashboardProxyRequest(): Promise<never>;
export declare function initMockifyerForDashboardProxy(): Promise<never>;
export declare function initMockifyerForLocalFilesystem(): never;
export declare function initMockifyerForDashboardProxyClients(): Promise<never>;
export declare function initMockifyerForLocalFilesystemClients(): never;
export declare function resolveClientInitFlags(): any;
export declare function needsSiblingClientSetup(): boolean;
export declare function syncDualMockifyerControls(): void;
export declare function pickPrimaryDualMockifyerInstance(_transport: string, _flags: any, result: any): any;
export declare function loadAxiosSetupMockifyer(): null;
export declare function loadFetchSetupMockifyer(): null;
export type InitMockifyerForDashboardProxyOptions = any;
export type InitMockifyerForLocalFilesystemOptions = any;
export type DualMockifyerControlSurface = any;
