import { MockData, StoredRequest } from '../types';
import { CachedMockData } from '../utils/mock-matcher';
import { DatabaseProvider, DatabaseProviderConfig } from './types';
/**
 * Hybrid Provider for React Native/Expo applications
 *
 * Saves mock data to BOTH:
 * 1. Device filesystem (via ExpoFileSystemProvider) - for app access
 * 2. Project folder (via Metro HTTP endpoint) - for version control
 *
 * This eliminates the need for polling-based sync - files are immediately
 * available in the project folder when saved.
 *
 * @example
 * ```typescript
 * const provider = new HybridProvider({
 *   path: 'mock-data',
 *   metroPort: 8081, // Optional, defaults to 8081
 * });
 * await provider.initialize();
 * ```
 */
export declare class HybridProvider implements DatabaseProvider {
    private deviceProvider;
    private metroPort;
    private metroUrl;
    constructor(config: DatabaseProviderConfig);
    initialize(): Promise<void>;
    /**
     * Save mock data to both device and project folder
     */
    save(mockData: MockData): Promise<void>;
    /**
     * Save mock data to project folder via Metro HTTP endpoint
     */
    private saveToProjectFolder;
    /**
     * Find exact match - delegate to device provider
     */
    findExactMatch(request: StoredRequest, requestKey: string): Promise<CachedMockData | undefined>;
    /**
     * Find all for similar match - delegate to device provider
     */
    findAllForSimilarMatch(request: StoredRequest): Promise<CachedMockData[]>;
    /**
     * Check if mock exists - delegate to device provider
     */
    exists(requestKey: string): Promise<boolean>;
    /**
     * Get all mocks - delegate to device provider
     */
    getAll(): Promise<MockData[]>;
    /**
     * Get the device mock data path
     */
    getMockDataPath(): string;
    /**
     * Clear all mocks from both device and project folder
     */
    clearAll(): Promise<void>;
    /**
     * Reload mock files (clears cache so files are re-read)
     * Optionally syncs files from project folder to device first
     */
    reload(syncFromProject?: boolean): Promise<void>;
    /**
     * Sync mock files from project folder to device via Metro endpoint
     */
    private syncFromProjectFolder;
    /**
     * Cleanup resources
     */
    close(): void;
}
//# sourceMappingURL=hybrid-provider.d.ts.map