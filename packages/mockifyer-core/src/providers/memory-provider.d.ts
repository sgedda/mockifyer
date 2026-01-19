import { MockData, StoredRequest } from '../types';
import { CachedMockData } from '../utils/mock-matcher';
import { DatabaseProvider, DatabaseProviderConfig } from './types';
/**
 * In-memory provider for React Native/Expo and other environments without filesystem access
 * Stores mock data in memory - data is lost when the app restarts
 * Perfect for development and testing scenarios
 */
export declare class MemoryProvider implements DatabaseProvider {
    private mocks;
    private mockCounter;
    constructor(config: DatabaseProviderConfig);
    initialize(): void;
    save(mockData: MockData): void;
    findExactMatch(request: StoredRequest, requestKey: string): CachedMockData | undefined;
    findAllForSimilarMatch(request: StoredRequest): CachedMockData[];
    exists(requestKey: string): boolean;
    getAll(): MockData[];
    /**
     * Clear all stored mocks (useful for testing)
     */
    clear(): void;
    /**
     * Clear all stored mocks (alias for clear() to match DatabaseProvider interface)
     */
    clearAll(): void;
    /**
     * Get the number of stored mocks
     */
    size(): number;
}
//# sourceMappingURL=memory-provider.d.ts.map