/**
 * React Native/Expo Helper Functions
 *
 * Simplified setup for React Native applications with automatic
 * conditional provider selection (FileSystem in dev, Memory in prod)
 */
import { setupMockifyer } from './index';
import { HTTPClient } from '@sgedda/mockifyer-core';
export interface MockifyerInstance extends HTTPClient {
    reloadMockData: () => void;
    clearStaleCacheEntries: () => number;
    clearAllMocks: () => Promise<void>;
}
export interface ReactNativeMockifyerConfig {
    /** Whether we're in development mode (determines which provider to use) */
    isDev: boolean;
    /** Path to mock data directory (used in development) */
    mockDataPath?: string;
    /** Path to bundled mock data file (used in production) */
    bundledDataPath?: string;
    /** Enable recording mode (development only) */
    recordMode?: boolean;
    /** Additional Mockifyer config options */
    config?: Partial<Parameters<typeof setupMockifyer>[0]>;
}
/**
 * Setup Mockifyer for React Native/Expo with automatic conditional provider selection
 *
 * - Development (isDev === true): Uses Expo FileSystem provider - can record mocks
 * - Production (isDev === false): Uses Memory provider with bundled TypeScript file
 *
 * @example
 * ```typescript
 * import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch/react-native';
 *
 * await setupMockifyerForReactNative({
 *   isDev: __DEV__, // Pass React Native's __DEV__ variable
 *   mockDataPath: 'mock-data',
 *   bundledDataPath: './assets/mock-data',
 *   recordMode: process.env.MOCKIFYER_RECORD === 'true',
 * });
 * ```
 */
export declare function setupMockifyerForReactNative(options: ReactNativeMockifyerConfig): Promise<MockifyerInstance | null>;
//# sourceMappingURL=react-native.d.ts.map