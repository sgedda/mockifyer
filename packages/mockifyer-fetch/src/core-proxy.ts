/**
 * Proxy/dashboard helpers from core via subpath exports (RN-safe; avoids barrel resolution).
 */
export { applyProxyRecordOnMissEnv } from '@sgedda/mockifyer-core/utils/apply-proxy-record-on-miss-env';
export { mirrorProxyRecordingToClient } from '@sgedda/mockifyer-core/utils/mirror-proxy-recording-to-client';
export {
  initMockifyerForDashboardProxy,
  initMockifyerForLocalFilesystem,
  type InitMockifyerForDashboardProxyOptions,
  type InitMockifyerForLocalFilesystemOptions,
} from '@sgedda/mockifyer-core/utils/init-mockifyer-presets';
export { performDashboardProxyRequest } from '@sgedda/mockifyer-core/utils/perform-dashboard-proxy-request';
