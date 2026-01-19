import { MockData, StoredRequest } from '../types';
import { CachedMockData } from '../utils/mock-matcher';
import { DatabaseProvider, DatabaseProviderConfig } from './types';
/**
 * Expo FileSystem provider for React Native/Expo applications
 * Uses expo-file-system to read/write files on the device's filesystem
 * Files are stored in the app's document directory and persist across app restarts
 *
 * Installation: npm install expo-file-system
 */
export declare class ExpoFileSystemProvider implements DatabaseProvider {
    private mockDataPath;
    private FileSystem;
    private fileCache;
    private fileModTimes;
    private watchInterval;
    private watchEnabled;
    private watchIntervalMs;
    private onFilesChanged?;
    private currentScenario;
    constructor(config: DatabaseProviderConfig);
    /**
     * Get current scenario (async version for Expo FileSystem)
     * Tries local config first, then Metro endpoint as fallback
     */
    private getCurrentScenario;
    /**
     * Get scenario folder path
     */
    private getScenarioPath;
    /**
     * Ensure scenario folder exists
     */
    private ensureScenarioFolder;
    initialize(): Promise<void>;
    /**
     * Start watching for file changes
     */
    private startFileWatching;
    /**
     * Stop watching for file changes
     */
    private stopFileWatching;
    /**
     * Check for file changes and clear cache if files changed
     */
    private checkForFileChanges;
    /**
     * Manually reload/refresh mock files
     * Clears the cache so files are re-read on next request
     * Also refreshes file modification times to detect changes
     */
    reload(): Promise<void>;
    /**
     * Enable or disable file watching
     */
    setWatchEnabled(enabled: boolean): void;
    save(mockData: MockData): Promise<void>;
    findExactMatch(request: StoredRequest, requestKey: string): Promise<CachedMockData | undefined>;
    findAllForSimilarMatch(request: StoredRequest): Promise<CachedMockData[]>;
    exists(requestKey: string): Promise<boolean>;
    getAll(): Promise<MockData[]>;
    /**
     * List all JSON files in the mock data directory
     */
    private listMockFiles;
    /**
     * Get the full path to the mock data directory
     */
    getMockDataPath(): string;
    /**
     * Cleanup resources (stop file watching)
     */
    close(): void;
    /**
     * Clear all mock files from the directory
     */
    clearAll(): Promise<void>;
}
//# sourceMappingURL=expo-filesystem-provider.d.ts.map