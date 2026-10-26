/**
 * Metro web entry for init-mockifyer-presets.
 * 
 * Metro only resolves .native.ts for iOS/Android platforms.
 * For web platform (expo start --web), we need .web.ts to ensure
 * load-sibling-setup resolves to the web variant (which avoids
 * dynamic require() calls that Metro rejects).
 * 
 * This file re-exports everything from init-mockifyer-presets
 * but overrides the two load functions with web/native stubs.
 */

// Override these two functions with native stubs (no dynamic requires)
export {
  loadAxiosSetupMockifyer,
  loadFetchSetupMockifyer,
} from './load-sibling-setup.web';

// Re-export everything else from the base file
export type {
  InitMockifyerForDashboardProxyOptions,
  InitMockifyerForLocalFilesystemOptions,
  SetupMockifyerFn,
  DualClientSetups,
  DualClientInitResult,
  DualMockifyerControlSurface,
  ResolveClientInitFlagsDefaults,
} from './init-mockifyer-presets';

export {
  omitProxyFromPartialConfig,
  resolveClientInitFlags,
  needsSiblingClientSetup,
  splitDualClientConfigs,
  syncDualMockifyerControls,
  pickPrimaryDualMockifyerInstance,
  buildDashboardProxyConfig,
  buildLocalFilesystemConfig,
  initMockifyerForDashboardProxy,
  initMockifyerForDashboardProxyClients,
  initMockifyerForLocalFilesystem,
  initMockifyerForLocalFilesystemClients,
} from './init-mockifyer-presets';
