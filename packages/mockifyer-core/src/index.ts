// Export all core types and utilities
export * from './types';
export * from './types/http-client';
export * from './clients/base-http-client';
export * from './utils/mock-matcher';
export * from './utils/mock-body-similarity';
export * from './utils/date';
export * from './utils/mock-response-date-overrides';
export * from './utils/scenario';
export * from './utils/scenario-meta';
export * from './providers';
// build-utils uses Node fs/path — not in main entry (breaks React Native / Metro).
// Import from '@sgedda/mockifyer-core/utils/build-utils' in Node.js build scripts only.
export * from './utils/test-generator';
export * from './utils/logger';
export * from './utils/file-naming';
export * from './utils/url-exclusion';
export * from './utils/recording-exclusion';
export * from './utils/mock-passthrough';
export * from './utils/mock-replay-mode';
export * from './utils/request-only-mock';
export * from './utils/domain-path-rules';
export * from './utils/record-passthrough-config';
export * from './utils/client-id';
export * from './utils/runtime-client-id';
export * from './utils/launch-arguments-client-id';
export * from './utils/activation-mode';
export * from './utils/outbound-header';
export * from './utils/request-correlation';
export * from './utils/runtime-mode';
export * from './utils/strict-proxy-scenario';
export * from './utils/proxy-strict-lane-scenario';
export * from './utils/proxy-record-on-miss-env';
export * from './utils/join-proxy-dashboard-api-url';
export * from './utils/dashboard-central-proxy-health';
export * from './utils/dashboard-proxy-envelope';
export * from './utils/perform-dashboard-proxy-request';
export * from './utils/apply-proxy-record-on-miss-env';
export * from './utils/init-mockifyer-presets';
export * from './utils/mirror-proxy-recording-to-client';
export * from './utils/recording-default-always-live';
export * from './utils/mockifyer-init-log';
export * from './utils/mock-response-field-overrides';
export * from './utils/mock-response-prepare';
export * from './utils/network-log';
export * from './utils/network-trace';
export * from './utils/ai-context';

// CLI exports removed - use bin commands instead:
// - mockifyer (for generate-bundle)
// - mockifyer-sync-to-device-manifest / mockifyer-sync-to-device-file / mockifyer-sync-to-device (legacy)
// - mockifyer-sync-from-device
// 
// If you need CLI functions programmatically in Node.js scripts,
// import directly from the CLI files:
// import { syncToDevice } from '@sgedda/mockifyer-core/src/cli/sync-to-device';

