/**
 * Metro web entry for sibling setup loaders.
 * 
 * Metro only resolves .native.ts for iOS/Android platforms.
 * For web platform (expo start --web), we need .web.ts to avoid
 * loading the Node version with dynamic require() calls.
 * 
 * This file re-exports the native stubs (no dynamic requires).
 */

export { loadAxiosSetupMockifyer, loadFetchSetupMockifyer } from './load-sibling-setup.native';
