/**
 * Node.js entry for init-mockifyer-presets.
 * Re-exports from the base implementation.
 */

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
  loadAxiosSetupMockifyer,
  loadFetchSetupMockifyer,
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
