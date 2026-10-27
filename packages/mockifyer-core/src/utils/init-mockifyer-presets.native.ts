/**
 * Metro entry for init-mockifyer-presets.
 *
 * Re-exports everything from init-mockifyer-presets.base, but overrides the
 * loadAxiosSetupMockifyer and loadFetchSetupMockifyer functions to use
 * the native versions (without dynamic require() calls that Metro rejects).
 */

// Override these two functions with native stubs
export {
  loadAxiosSetupMockifyer,
  loadFetchSetupMockifyer,
} from './load-sibling-setup.native';

// Re-export everything else from the base file
export type {
  InitMockifyerForDashboardProxyOptions,
  InitMockifyerForLocalFilesystemOptions,
  SetupMockifyerFn,
  DualClientSetups,
  DualClientInitResult,
  DualMockifyerControlSurface,
  ResolveClientInitFlagsDefaults,
} from './init-mockifyer-presets.base';

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
} from './init-mockifyer-presets.base';
