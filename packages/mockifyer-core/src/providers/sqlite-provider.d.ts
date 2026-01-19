import { MockData, StoredRequest } from '../types';
import { CachedMockData } from '../utils/mock-matcher';
import { DatabaseProvider, DatabaseProviderConfig } from './types';
/**
 * SQLite-based provider for storing mock data
 * Uses better-sqlite3 for synchronous operations (better performance)
 */
export declare class SQLiteProvider implements DatabaseProvider {
    private dbPath;
    private db;
    constructor(config: DatabaseProviderConfig);
    initialize(): void;
    save(mockData: MockData): void;
    findExactMatch(request: StoredRequest, requestKey: string): CachedMockData | undefined;
    findAllForSimilarMatch(request: StoredRequest): CachedMockData[];
    exists(requestKey: string): boolean;
    getAll(): MockData[];
    close(): void;
}
//# sourceMappingURL=sqlite-provider.d.ts.map