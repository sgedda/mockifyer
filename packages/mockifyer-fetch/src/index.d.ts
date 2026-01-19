import { MockifyerConfig, HTTPClient } from '@sgedda/mockifyer-core';
export interface MockifyerInstance extends HTTPClient {
    reloadMockData: () => Promise<void>;
    clearStaleCacheEntries: () => number;
    clearAllMocks: () => Promise<void>;
}
export declare function setupMockifyer(config: MockifyerConfig): MockifyerInstance;
export * from '@sgedda/mockifyer-core';
export * from './react-native';
//# sourceMappingURL=index.d.ts.map