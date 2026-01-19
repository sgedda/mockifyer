import { MockData, StoredRequest, ENV_VARS } from '../types';
import { CachedMockData, generateRequestKey } from '../utils/mock-matcher';
import { DatabaseProvider, DatabaseProviderConfig } from './types';
import { logger } from '../utils/logger';

const DEFAULT_SCENARIO = 'default';

/**
 * Expo FileSystem provider for React Native/Expo applications
 * Uses expo-file-system to read/write files on the device's filesystem
 * Files are stored in the app's document directory and persist across app restarts
 * 
 * Installation: npm install expo-file-system
 */
export class ExpoFileSystemProvider implements DatabaseProvider {
  private mockDataPath: string;
  private FileSystem: any; // expo-file-system module
  private fileCache: Map<string, { mtime: number; content: CachedMockData }> = new Map(); // Key: requestKey
  private fileModTimes: Map<string, number> = new Map(); // Key: filename, Value: mtime
  private watchInterval: NodeJS.Timeout | null = null;
  private watchEnabled: boolean = false;
  private watchIntervalMs: number = 2000; // Check every 2 seconds
  private onFilesChanged?: () => void;
  private currentScenario: string = DEFAULT_SCENARIO;

  constructor(config: DatabaseProviderConfig) {
    if (!config.path) {
      throw new Error('ExpoFileSystemProvider requires a path in config');
    }
    this.mockDataPath = config.path;
    
    // Enable file watching if configured
    if (config.options?.watchFiles !== false) {
      this.watchEnabled = true;
      this.watchIntervalMs = config.options?.watchInterval || 2000;
      this.onFilesChanged = config.options?.onFilesChanged;
    }
    
    // Try to import expo-file-system
    try {
      // Use dynamic import for React Native compatibility
      this.FileSystem = require('expo-file-system');
    } catch (e) {
      throw new Error(
        'expo-file-system is required for ExpoFileSystemProvider. Install it with: npx expo install expo-file-system'
      );
    }
  }

  /**
   * Get current scenario (async version for Expo FileSystem)
   * Tries local config first, then Metro endpoint as fallback
   */
  private async getCurrentScenario(): Promise<string> {
    // Check environment variable first
    const envScenario = process.env[ENV_VARS.MOCK_SCENARIO];
    if (envScenario) {
      return envScenario;
    }

    // Try to fetch from Metro endpoint FIRST (for React Native dev mode)
    // This allows dashboard changes to be picked up by the app immediately
    // Metro is the source of truth in development mode
    try {
      const metroPort = process.env.METRO_PORT ? parseInt(process.env.METRO_PORT, 10) : 8081;
      const metroUrl = `http://localhost:${metroPort}/mockifyer-scenario-config`;
      
      // Use fetch if available (React Native has global fetch)
      // Add cache-busting query parameter to ensure we get fresh data
      const cacheBustUrl = `${metroUrl}?t=${Date.now()}`;
      if (typeof fetch !== 'undefined') {
        const response = await fetch(cacheBustUrl, {
          // Add timeout to avoid hanging if Metro is not available
          signal: AbortSignal.timeout?.(2000) || undefined,
          // Disable cache to ensure fresh data
          cache: 'no-store',
        } as any);
        if (response.ok) {
          const data = await response.json() as { success?: boolean; currentScenario?: string };
          if (data.success && data.currentScenario) {
            // Always save to local config to keep it in sync with Metro
            const configPath = this.mockDataPath + '/scenario-config.json';
            const config = {
              currentScenario: data.currentScenario,
              updatedAt: new Date().toISOString()
            };
            await this.FileSystem.writeAsStringAsync(
              configPath,
              JSON.stringify(config, null, 2)
            );
            logger.info(`[ExpoFileSystemProvider] ✅ Synced scenario config from Metro: ${data.currentScenario}`);
            return data.currentScenario;
          } else {
            logger.debug(`[ExpoFileSystemProvider] Metro returned invalid response format:`, data);
          }
        } else {
          logger.debug(`[ExpoFileSystemProvider] Metro endpoint returned status ${response.status}`);
        }
      }
    } catch (error) {
      // Metro not available - fall back to local config
      logger.debug('[ExpoFileSystemProvider] Metro endpoint not available, using local config:', error);
    }

    // Fallback: Try to load from local scenario-config.json
    try {
      const configPath = this.mockDataPath + '/scenario-config.json';
      const configInfo = await this.FileSystem.getInfoAsync(configPath);
      if (configInfo.exists) {
        const fileContent = await this.FileSystem.readAsStringAsync(configPath);
        const config = JSON.parse(fileContent);
        if (config.currentScenario) {
          logger.info(`[ExpoFileSystemProvider] Using local scenario config: ${config.currentScenario} (Metro sync failed or unavailable)`);
          return config.currentScenario;
        }
      }
    } catch (error) {
      // Silently fail - file might not exist or be invalid
    }

    logger.info(`[ExpoFileSystemProvider] Using default scenario: ${DEFAULT_SCENARIO}`);
    return DEFAULT_SCENARIO;
  }

  /**
   * Get scenario folder path
   */
  private getScenarioPath(scenario?: string): string {
    const scenarioName = scenario || this.currentScenario;
    return this.mockDataPath + '/' + scenarioName;
  }

  /**
   * Ensure scenario folder exists
   */
  private async ensureScenarioFolder(scenario?: string): Promise<string> {
    const scenarioPath = this.getScenarioPath(scenario);
    const dirInfo = await this.FileSystem.getInfoAsync(scenarioPath);
    if (!dirInfo.exists) {
      await this.FileSystem.makeDirectoryAsync(scenarioPath, { intermediates: true });
    }
    return scenarioPath;
  }

  async initialize(): Promise<void> {
    // Get the document directory path
    const documentDir = this.FileSystem.documentDirectory;
    if (!documentDir) {
      throw new Error('Could not access document directory');
    }

    // Resolve the full path
    const fullPath = this.FileSystem.documentDirectory + this.mockDataPath;
    
    // Check if directory exists, create if not
    const dirInfo = await this.FileSystem.getInfoAsync(fullPath);
    if (!dirInfo.exists) {
      await this.FileSystem.makeDirectoryAsync(fullPath, { intermediates: true });
      logger.info(`[Mockifyer] Created mock data directory: ${fullPath}`);
    } else {
      logger.info(`[Mockifyer] Using existing mock data directory: ${fullPath}`);
    }
    
    this.mockDataPath = fullPath;
    
    // Get current scenario and ensure scenario folder exists
    this.currentScenario = await this.getCurrentScenario();
    const scenarioPath = await this.ensureScenarioFolder();
    logger.info(`[Mockifyer] Using scenario: ${this.currentScenario} (path: ${scenarioPath})`);
    
    // Start file watching if enabled
    if (this.watchEnabled) {
      this.startFileWatching();
    }
  }

  /**
   * Start watching for file changes
   */
  private startFileWatching(): void {
    if (this.watchInterval) {
      return; // Already watching
    }

    logger.debug(`[ExpoFileSystemProvider] 🔄 Starting file watching (checking every ${this.watchIntervalMs}ms)`);
    
    this.watchInterval = setInterval(async () => {
      await this.checkForFileChanges();
    }, this.watchIntervalMs);
  }

  /**
   * Stop watching for file changes
   */
  private stopFileWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
      logger.debug('[ExpoFileSystemProvider] ⏹️ Stopped file watching');
    }
  }

  /**
   * Check for file changes and clear cache if files changed
   */
  private async checkForFileChanges(): Promise<void> {
    try {
      const files = await this.listMockFiles();
      let hasChanges = false;

      // Check if any files were added, removed, or modified
      const currentFileSet = new Set(files);
      const cachedFileSet = new Set(this.fileModTimes.keys());

      // Check for new or removed files
      if (currentFileSet.size !== cachedFileSet.size) {
        hasChanges = true;
      } else {
        // Check for modified files
        const scenarioPath = this.getScenarioPath();
        for (const file of files) {
          try {
            const filePath = scenarioPath + '/' + file;
            const fileInfo = await this.FileSystem.getInfoAsync(filePath);
            
            if (fileInfo.exists && fileInfo.modificationTime) {
              const cachedMtime = this.fileModTimes.get(file);
              if (cachedMtime === undefined || cachedMtime !== fileInfo.modificationTime) {
                hasChanges = true;
                break;
              }
            }
          } catch (error) {
            // Ignore errors checking individual files
          }
        }
      }

      if (hasChanges) {
        this.fileCache.clear();
        this.fileModTimes.clear();
        
        // Update modification times for current files
        const scenarioPath = this.getScenarioPath();
        for (const file of files) {
          try {
            const filePath = scenarioPath + '/' + file;
            const fileInfo = await this.FileSystem.getInfoAsync(filePath);
            if (fileInfo.exists && fileInfo.modificationTime) {
              this.fileModTimes.set(file, fileInfo.modificationTime);
            }
          } catch (error) {
            // Ignore errors
          }
        }
        
        // Notify callback if provided
        if (this.onFilesChanged) {
          this.onFilesChanged();
        }
      } else {
        // Update modification times even if no changes (for initial population)
        const scenarioPath = this.getScenarioPath();
        for (const file of files) {
          if (!this.fileModTimes.has(file)) {
            try {
              const filePath = scenarioPath + '/' + file;
              const fileInfo = await this.FileSystem.getInfoAsync(filePath);
              if (fileInfo.exists && fileInfo.modificationTime) {
                this.fileModTimes.set(file, fileInfo.modificationTime);
              }
            } catch (error) {
              // Ignore errors
            }
          }
        }
      }
    } catch (error) {
      // Silently fail - don't spam logs
      logger.debug('[ExpoFileSystemProvider] Error checking for file changes:', error);
    }
  }

  /**
   * Manually reload/refresh mock files
   * Clears the cache so files are re-read on next request
   * Also refreshes file modification times to detect changes
   */
  async reload(): Promise<void> {
    // Clear all caches
    this.fileCache.clear();
    this.fileModTimes.clear();
    
    // Force refresh of file modification times by re-reading directory
    // This ensures that synced files are detected on next request
    try {
      const files = await this.listMockFiles();
      
      // Update modification times
      const scenarioPath = this.getScenarioPath();
      for (const file of files) {
        try {
          const filePath = scenarioPath + '/' + file;
          const fileInfo = await this.FileSystem.getInfoAsync(filePath);
          if (fileInfo.exists && fileInfo.modificationTime) {
            this.fileModTimes.set(file, fileInfo.modificationTime);
          }
        } catch (error) {
          // Ignore errors for individual files
        }
      }
    } catch (error) {
      console.warn('[ExpoFileSystemProvider] ⚠️ Error refreshing file list during reload:', error);
    }
    
    if (this.onFilesChanged) {
      this.onFilesChanged();
    }
  }

  /**
   * Enable or disable file watching
   */
  setWatchEnabled(enabled: boolean): void {
    this.watchEnabled = enabled;
    if (enabled && !this.watchInterval) {
      this.startFileWatching();
    } else if (!enabled && this.watchInterval) {
      this.stopFileWatching();
    }
  }

  async save(mockData: MockData): Promise<void> {
    // CRITICAL: Never save sync endpoint requests or Resend API requests - they should never be mocked
    const requestUrl = mockData?.request?.url || '';
    if (requestUrl.includes('/mockifyer-save') || 
        requestUrl.includes('/mockifyer-clear') || 
        requestUrl.includes('/mockifyer-sync') ||
        requestUrl.includes('api.resend.com')) {
      logger.debug(`[ExpoFileSystemProvider] ⚠️ Skipping save - request URL is excluded: ${requestUrl}`);
      return;
    }
    
    
    const scenarioPath = await this.ensureScenarioFolder();
    
    // Check request limit before saving (only if limit is set via env var)
    const MAX_REQUESTS_PER_SCENARIO = process.env.MOCKIFYER_MAX_REQUESTS_PER_SCENARIO 
      ? parseInt(process.env.MOCKIFYER_MAX_REQUESTS_PER_SCENARIO, 10) 
      : undefined;
    if (MAX_REQUESTS_PER_SCENARIO !== undefined) {
      try {
        const files = await this.FileSystem.readDirectoryAsync(scenarioPath);
        const jsonFiles = files.filter((file: string) => 
          file.endsWith('.json') && file !== 'scenario-config.json' && file !== 'date-config.json'
        );
        
        if (jsonFiles.length >= MAX_REQUESTS_PER_SCENARIO) {
          const errorMessage = `Maximum ${MAX_REQUESTS_PER_SCENARIO} requests per scenario reached for scenario "${this.currentScenario}". Please delete some mock files or switch to a different scenario.`;
          logger.warn(`[Mockifyer] ⚠️ ${errorMessage}`);
          // Don't throw - just log and return to prevent app crash
          return;
        }
      } catch (error: any) {
        // If directory doesn't exist or can't read, that's okay - we'll create it
        // Ignore errors and continue (directory might not exist yet)
        logger.warn(`[ExpoFileSystemProvider] Could not check file count:`, error);
      }
    }
    
    // Format the datetime to be readable
    const now = new Date();
    const dateStr = now.toISOString()
      .replace(/T/, '_')
      .replace(/\..+/, '')
      .replace(/:/g, '-');

    // Create a safe filename from the URL
    const urlSafe = mockData.request.url
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]/g, '_');

    const filename = `${dateStr}_${mockData.request.method}_${urlSafe}.json`;
    const filePath = scenarioPath + '/' + filename;
    
    // Write to file (async)
    try {
      await this.FileSystem.writeAsStringAsync(
        filePath,
        JSON.stringify(mockData, null, 2)
      );
      
      // Verify file was saved and update cache
      const fileInfo = await this.FileSystem.getInfoAsync(filePath);
      
      // Update modification time cache
      if (fileInfo.exists && fileInfo.modificationTime) {
        this.fileModTimes.set(filename, fileInfo.modificationTime);
        // Clear request cache for this file (will be re-read on next request)
        // Note: We can't easily find the requestKey here, so we'll let it be cleared on next findExactMatch
      }
    } catch (error) {
      logger.error(`[ExpoFileSystemProvider] ❌ Error saving mock file:`, error);
      throw error;
    }
  }

  async findExactMatch(request: StoredRequest, requestKey: string): Promise<CachedMockData | undefined> {
    // Check cache first, but verify file hasn't been modified
    const cached = this.fileCache.get(requestKey);
    if (cached) {
      // Verify the cached file still exists and hasn't been modified
      try {
        const filePath = cached.content.filePath;
        const fileInfo = await this.FileSystem.getInfoAsync(filePath);
        
        if (fileInfo.exists) {
          const currentMtime = fileInfo.modificationTime || Date.now();
          const cachedMtime = cached.mtime;
          
          // If file hasn't changed, return cached result
          if (currentMtime === cachedMtime) {
            return cached.content;
          } else {
            // File has been modified, clear cache entry and re-read
            this.fileCache.delete(requestKey);
          }
        } else {
          // File no longer exists, clear cache
          this.fileCache.delete(requestKey);
        }
      } catch (error) {
        // Error checking file, clear cache and re-read
        console.warn(`[ExpoFileSystemProvider] Error checking cached file, clearing cache:`, error);
        this.fileCache.delete(requestKey);
      }
    }
    // CRITICAL: Never try to match sync endpoint requests - they should never be mocked
    const requestUrl = request?.url || '';
    if (requestUrl.includes('/mockifyer-save') || 
        requestUrl.includes('/mockifyer-clear') || 
        requestUrl.includes('/mockifyer-sync')) {
      return undefined;
    }
    
    // CRITICAL: Also check requestKey for sync endpoint URLs (defense in depth)
    if (requestKey.includes('/mockifyer-save') || 
        requestKey.includes('/mockifyer-clear') || 
        requestKey.includes('/mockifyer-sync')) {
      return undefined;
    }
    
    const files = await this.listMockFiles();
    const scenarioPath = this.getScenarioPath();
    
    // Collect all matching files with their modification times
    const matches: Array<{ file: string; filePath: string; mockData: MockData; mtime: number }> = [];
    
    for (const file of files) {
      try {
        const filePath = scenarioPath + '/' + file;
        const fileContent = await this.FileSystem.readAsStringAsync(filePath);
        
        // CRITICAL: Skip corrupted files that contain Mockifyer sync endpoint requests
        if (fileContent.includes('/mockifyer-save') || 
            fileContent.includes('/mockifyer-clear') || 
            fileContent.includes('/mockifyer-sync') ||
            fileContent.includes('Cannot save Mockifyer sync endpoint requests')) {
          continue;
        }
        
        const mockData: MockData = JSON.parse(fileContent);
        
        if (!mockData?.request || typeof mockData.request !== 'object') {
          continue;
        }
        
        // CRITICAL: Also check the parsed mockData for sync endpoint URLs
        const requestUrl = mockData.request?.url || '';
        if (requestUrl.includes('/mockifyer-save') || 
            requestUrl.includes('/mockifyer-clear') || 
            requestUrl.includes('/mockifyer-sync')) {
          continue;
        }

        // Generate key for this mock and compare with requested key
        const mockKey = generateRequestKey(mockData.request);
        if (mockKey === requestKey) {
          // Get file modification time
          let fileMtime = 0;
          try {
            const fileInfo = await this.FileSystem.getInfoAsync(filePath);
            fileMtime = fileInfo.modificationTime || Date.now();
          } catch (error) {
            fileMtime = Date.now();
          }
          
          matches.push({ file, filePath, mockData, mtime: fileMtime });
        }
      } catch (error) {
        logger.warn(`[Mockifyer] Failed to load mock file ${file}:`, error);
      }
    }
    
    // If we found matches, use the one with the latest modification time
    if (matches.length > 0) {
      // Sort by modification time (newest first)
      matches.sort((a, b) => b.mtime - a.mtime);
      const bestMatch = matches[0];
      
      
      // Cache the result
      try {
        const fileInfo = await this.FileSystem.getInfoAsync(bestMatch.filePath);
        const cachedResult: CachedMockData = {
          mockData: bestMatch.mockData,
          filename: bestMatch.file,
          filePath: bestMatch.filePath
        };
        this.fileCache.set(requestKey, {
          mtime: fileInfo.modificationTime || bestMatch.mtime,
          content: cachedResult
        });
      } catch (error) {
        // Ignore cache errors
      }
      
      return {
        mockData: bestMatch.mockData,
        filename: bestMatch.file,
        filePath: bestMatch.filePath
      };
    }

    logger.debug(`[ExpoFileSystemProvider] ⚠️ No exact match found`);
    return undefined;
  }

  async findAllForSimilarMatch(request: StoredRequest): Promise<CachedMockData[]> {
    // CRITICAL: Never try to match sync endpoint requests - they should never be mocked
    const requestUrl = request?.url || '';
    if (requestUrl.includes('/mockifyer-save') || 
        requestUrl.includes('/mockifyer-clear') || 
        requestUrl.includes('/mockifyer-sync')) {
      logger.debug(`[ExpoFileSystemProvider] ⚠️ Skipping findAllForSimilarMatch - request URL is a sync endpoint: ${requestUrl}`);
      return [];
    }
    
    const files = await this.listMockFiles();
    const scenarioPath = this.getScenarioPath();
    const results: CachedMockData[] = [];

    for (const file of files) {
      try {
        const filePath = scenarioPath + '/' + file;
        const fileContent = await this.FileSystem.readAsStringAsync(filePath);
        
        // CRITICAL: Skip corrupted files that contain Mockifyer sync endpoint requests
        if (fileContent.includes('/mockifyer-save') || 
            fileContent.includes('/mockifyer-clear') || 
            fileContent.includes('/mockifyer-sync') ||
            fileContent.includes('Cannot save Mockifyer sync endpoint requests')) {
          logger.debug(`[ExpoFileSystemProvider] ⚠️ Skipping corrupted file ${file} - contains Mockifyer sync endpoint`);
          continue;
        }
        
        const mockData: MockData = JSON.parse(fileContent);
        
        if (!mockData?.request || typeof mockData.request !== 'object') {
          continue;
        }
        
        // CRITICAL: Also check the parsed mockData for sync endpoint URLs
        const requestUrl = mockData.request?.url || '';
        if (requestUrl.includes('/mockifyer-save') || 
            requestUrl.includes('/mockifyer-clear') || 
            requestUrl.includes('/mockifyer-sync')) {
          logger.debug(`[ExpoFileSystemProvider] ⚠️ Skipping corrupted file ${file} - request URL is a sync endpoint`);
          continue;
        }

        // Check if path and method match
        try {
          const requestUrl = new URL(request.url);
          const mockUrl = new URL(mockData.request.url);
          const requestPath = requestUrl.pathname;
          const mockPath = mockUrl.pathname;
          
          if (mockPath === requestPath && 
              (mockData.request.method || 'GET').toUpperCase() === (request.method || 'GET').toUpperCase()) {
            results.push({
              mockData,
              filename: file,
              filePath: filePath
            });
          }
        } catch (e) {
          // Invalid URL, skip
          continue;
        }
      } catch (error) {
        logger.warn(`[Mockifyer] Failed to load mock file ${file}:`, error);
      }
    }

    return results;
  }

  async exists(requestKey: string): Promise<boolean> {
    // For filesystem provider, we can't efficiently check existence by key
    // without reading all files. This will be handled by findExactMatch
    return false;
  }

  async getAll(): Promise<MockData[]> {
    const files = await this.listMockFiles();
    const scenarioPath = this.getScenarioPath();
    const results: MockData[] = [];

    for (const file of files) {
      try {
        const filePath = scenarioPath + '/' + file;
        const fileContent = await this.FileSystem.readAsStringAsync(filePath);
        
        // CRITICAL: Skip corrupted files that contain Mockifyer sync endpoint requests
        if (fileContent.includes('/mockifyer-save') || 
            fileContent.includes('/mockifyer-clear') || 
            fileContent.includes('/mockifyer-sync') ||
            fileContent.includes('Cannot save Mockifyer sync endpoint requests')) {
          logger.debug(`[ExpoFileSystemProvider] ⚠️ Skipping corrupted file ${file} - contains Mockifyer sync endpoint`);
          continue;
        }
        
        const mockData: MockData = JSON.parse(fileContent);
        
        // CRITICAL: Also check the parsed mockData for sync endpoint URLs
        const requestUrl = mockData.request?.url || '';
        if (requestUrl.includes('/mockifyer-save') || 
            requestUrl.includes('/mockifyer-clear') || 
            requestUrl.includes('/mockifyer-sync')) {
          logger.debug(`[ExpoFileSystemProvider] ⚠️ Skipping corrupted file ${file} - request URL is a sync endpoint`);
          continue;
        }
        
        results.push(mockData);
      } catch (error) {
        logger.warn(`[Mockifyer] Failed to load mock file ${file}:`, error);
      }
    }

    return results;
  }

  /**
   * List all JSON files in the mock data directory
   */
  private async listMockFiles(): Promise<string[]> {
    try {
      const scenarioPath = this.getScenarioPath();
      logger.debug(`[ExpoFileSystemProvider] listMockFiles - Reading from scenario: ${this.currentScenario}, path: ${scenarioPath}`);
      const dirInfo = await this.FileSystem.getInfoAsync(scenarioPath);
      if (!dirInfo.exists || !dirInfo.isDirectory) {
        logger.debug(`[ExpoFileSystemProvider] listMockFiles - Scenario directory does not exist: ${scenarioPath}`);
        return [];
      }
      
      const files = await this.FileSystem.readDirectoryAsync(scenarioPath);
      const jsonFiles = files.filter((file: string) => file.endsWith('.json'));
      logger.debug(`[ExpoFileSystemProvider] listMockFiles - Found ${jsonFiles.length} files in scenario ${this.currentScenario}`);
      return jsonFiles;
    } catch (error) {
      logger.warn(`[Mockifyer] Failed to list mock files:`, error);
      return [];
    }
  }

  /**
   * Get the full path to the mock data directory
   */
  getMockDataPath(): string {
    return this.mockDataPath;
  }

  /**
   * Cleanup resources (stop file watching)
   */
  close(): void {
    this.stopFileWatching();
  }

  /**
   * Clear all mock files from the directory
   */
  async clearAll(): Promise<void> {
    try {
      const files = await this.listMockFiles();
      logger.debug(`[ExpoFileSystemProvider] clearAll - Deleting ${files.length} mock files`);
      
      const scenarioPath = this.getScenarioPath();
      for (const file of files) {
        const filePath = scenarioPath + '/' + file;
        try {
          await this.FileSystem.deleteAsync(filePath, { idempotent: true });
        } catch (error) {
          logger.warn(`[ExpoFileSystemProvider] Failed to delete ${file}:`, error);
        }
      }
      
      // Clear cache after deleting files
      this.fileCache.clear();
      
    } catch (error) {
      logger.error(`[ExpoFileSystemProvider] ❌ Error clearing mock files:`, error);
      throw error;
    }
  }
}


