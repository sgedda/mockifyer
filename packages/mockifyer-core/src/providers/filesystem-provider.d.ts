import { MockData, StoredRequest } from '../types';
import { CachedMockData } from '../utils/mock-matcher';
import { DatabaseProvider, DatabaseProviderConfig } from './types';
/**
 * Filesystem-based provider (current default implementation)
 * Stores mock data as JSON files in a directory
 *
 * Note: This provider requires Node.js fs module and will not work in React Native.
 * For React Native, use ExpoFileSystemProvider instead.
 */
export declare class FilesystemProvider implements DatabaseProvider {
    private mockDataPath;
    private fsAvailable;
    constructor(config: DatabaseProviderConfig);
    initialize(): void;
    /**
     * Get the scenario-specific path for mock files
     */
    private getScenarioPath;
    save(mockData: MockData): void;
    findExactMatch(request: StoredRequest, requestKey: string): CachedMockData | undefined;
    findAllForSimilarMatch(request: StoredRequest): CachedMockData[];
    exists(requestKey: string): boolean;
    getAll(): MockData[];
}
//# sourceMappingURL=filesystem-provider.d.ts.map