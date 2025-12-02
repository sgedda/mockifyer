import { MockData, StoredRequest } from '../types';
import { CachedMockData, generateRequestKey } from '../utils/mock-matcher';
import { DatabaseProvider, DatabaseProviderConfig } from './types';

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
      console.log(`[Mockifyer] Created mock data directory: ${fullPath}`);
    } else {
      console.log(`[Mockifyer] Using existing mock data directory: ${fullPath}`);
    }
    
    this.mockDataPath = fullPath;
    
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

    console.log(`[ExpoFileSystemProvider] 🔄 Starting file watching (checking every ${this.watchIntervalMs}ms)`);
    
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
      console.log('[ExpoFileSystemProvider] ⏹️ Stopped file watching');
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
        for (const file of files) {
          try {
            const filePath = this.mockDataPath + '/' + file;
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
        console.log('[ExpoFileSystemProvider] 🔄 Detected file changes - clearing cache');
        this.fileCache.clear();
        this.fileModTimes.clear();
        
        // Update modification times for current files
        for (const file of files) {
          try {
            const filePath = this.mockDataPath + '/' + file;
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
        for (const file of files) {
          if (!this.fileModTimes.has(file)) {
            try {
              const filePath = this.mockDataPath + '/' + file;
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
      console.debug('[ExpoFileSystemProvider] Error checking for file changes:', error);
    }
  }

  /**
   * Manually reload/refresh mock files
   * Clears the cache so files are re-read on next request
   * Also refreshes file modification times to detect changes
   */
  async reload(): Promise<void> {
    console.log('[ExpoFileSystemProvider] 🔄 Manual reload - clearing cache and refreshing file list');
    
    // AGGRESSIVE: Clear all caches
    this.fileCache.clear();
    this.fileModTimes.clear();
    
    // Force refresh of file modification times by re-reading directory
    // This ensures that synced files are detected on next request
    try {
      const files = await this.listMockFiles();
      console.log(`[ExpoFileSystemProvider] 🔄 Reload found ${files.length} mock files`);
      
      // Log all files found for debugging
      for (const file of files) {
        try {
          const filePath = this.mockDataPath + '/' + file;
          const fileInfo = await this.FileSystem.getInfoAsync(filePath);
          if (fileInfo.exists && fileInfo.modificationTime) {
            this.fileModTimes.set(file, fileInfo.modificationTime);
            console.log(`[ExpoFileSystemProvider] 📄 File: ${file} (mtime: ${fileInfo.modificationTime})`);
          }
        } catch (error) {
          // Ignore errors for individual files
        }
      }
      
      console.log('[ExpoFileSystemProvider] ✅ Reload complete - cache cleared, files will be re-read on next request');
      console.log('[ExpoFileSystemProvider] 💡 Cache size after reload:', this.fileCache.size);
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
    console.log(`[ExpoFileSystemProvider] save - Saving mock data to: ${this.mockDataPath}`);
    
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
    const filePath = this.mockDataPath + '/' + filename;
    
    console.log(`[ExpoFileSystemProvider] save - File path: ${filePath}`);
    console.log(`[ExpoFileSystemProvider] save - Filename: ${filename}`);
    
    // Write to file (async)
    try {
      await this.FileSystem.writeAsStringAsync(
        filePath,
        JSON.stringify(mockData, null, 2)
      );
      console.log(`[ExpoFileSystemProvider] ✅ Successfully saved mock to file: ${filename}`);
      
      // Verify file was saved and update cache
      const fileInfo = await this.FileSystem.getInfoAsync(filePath);
      console.log(`[ExpoFileSystemProvider] save - File exists after save: ${fileInfo.exists}`);
      
      // Update modification time cache
      if (fileInfo.exists && fileInfo.modificationTime) {
        this.fileModTimes.set(filename, fileInfo.modificationTime);
        // Clear request cache for this file (will be re-read on next request)
        // Note: We can't easily find the requestKey here, so we'll let it be cleared on next findExactMatch
      }
    } catch (error) {
      console.error(`[ExpoFileSystemProvider] ❌ Error saving mock file:`, error);
      throw error;
    }
  }

  async findExactMatch(request: StoredRequest, requestKey: string): Promise<CachedMockData | undefined> {
    console.log(`[ExpoFileSystemProvider] 🔍 findExactMatch called for requestKey: ${requestKey}`);
    console.log(`[ExpoFileSystemProvider] 📊 Current cache size: ${this.fileCache.size}`);
    
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
            console.log(`[ExpoFileSystemProvider] ✅ Using cached match: ${cached.content.filename} (mtime: ${cachedMtime})`);
            return cached.content;
          } else {
            // File has been modified, clear cache entry and re-read
            console.log(`[ExpoFileSystemProvider] 🔄 File modified (${cached.content.filename}), clearing cache entry (cached: ${cachedMtime}, current: ${currentMtime})`);
            this.fileCache.delete(requestKey);
          }
        } else {
          // File no longer exists, clear cache
          console.log(`[ExpoFileSystemProvider] 🔄 File deleted (${cached.content.filename}), clearing cache entry`);
          this.fileCache.delete(requestKey);
        }
      } catch (error) {
        // Error checking file, clear cache and re-read
        console.warn(`[ExpoFileSystemProvider] ⚠️ Error checking cached file, clearing cache:`, error);
        this.fileCache.delete(requestKey);
      }
    }
    // CRITICAL: Never try to match sync endpoint requests - they should never be mocked
    const requestUrl = request?.url || '';
    if (requestUrl.includes('/mockifyer-save') || 
        requestUrl.includes('/mockifyer-clear') || 
        requestUrl.includes('/mockifyer-sync')) {
      console.log(`[ExpoFileSystemProvider] ⚠️ Skipping findExactMatch - request URL is a sync endpoint: ${requestUrl}`);
      return undefined;
    }
    
    // CRITICAL: Also check requestKey for sync endpoint URLs (defense in depth)
    if (requestKey.includes('/mockifyer-save') || 
        requestKey.includes('/mockifyer-clear') || 
        requestKey.includes('/mockifyer-sync')) {
      console.log(`[ExpoFileSystemProvider] ⚠️ Skipping findExactMatch - requestKey contains sync endpoint`);
      return undefined;
    }
    
    console.log(`[ExpoFileSystemProvider] findExactMatch - Looking for requestKey: ${requestKey}`);
    console.log(`[ExpoFileSystemProvider] findExactMatch - Mock data path: ${this.mockDataPath}`);
    
    const files = await this.listMockFiles();
    console.log(`[ExpoFileSystemProvider] findExactMatch - Found ${files.length} mock files`);
    
    // Collect all matching files with their modification times
    const matches: Array<{ file: string; filePath: string; mockData: MockData; mtime: number }> = [];
    
    for (const file of files) {
      try {
        const filePath = this.mockDataPath + '/' + file;
        const fileContent = await this.FileSystem.readAsStringAsync(filePath);
        
        // CRITICAL: Skip corrupted files that contain Mockifyer sync endpoint requests
        if (fileContent.includes('/mockifyer-save') || 
            fileContent.includes('/mockifyer-clear') || 
            fileContent.includes('/mockifyer-sync') ||
            fileContent.includes('Cannot save Mockifyer sync endpoint requests')) {
          console.log(`[ExpoFileSystemProvider] ⚠️ Skipping corrupted file ${file} - contains Mockifyer sync endpoint`);
          continue;
        }
        
        const mockData: MockData = JSON.parse(fileContent);
        
        if (!mockData?.request || typeof mockData.request !== 'object') {
          console.log(`[ExpoFileSystemProvider] Skipping ${file} - invalid request object`);
          continue;
        }
        
        // CRITICAL: Also check the parsed mockData for sync endpoint URLs
        const requestUrl = mockData.request?.url || '';
        if (requestUrl.includes('/mockifyer-save') || 
            requestUrl.includes('/mockifyer-clear') || 
            requestUrl.includes('/mockifyer-sync')) {
          console.log(`[ExpoFileSystemProvider] ⚠️ Skipping corrupted file ${file} - request URL is a sync endpoint`);
          continue;
        }

        // Generate key for this mock and compare with requested key
        const mockKey = generateRequestKey(mockData.request);
        console.log(`[ExpoFileSystemProvider] Checking ${file}: mockKey="${mockKey}" vs requestKey="${requestKey}"`);
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
        console.warn(`[Mockifyer] Failed to load mock file ${file}:`, error);
      }
    }
    
    // If we found matches, use the one with the latest modification time
    if (matches.length > 0) {
      // Sort by modification time (newest first)
      matches.sort((a, b) => b.mtime - a.mtime);
      const bestMatch = matches[0];
      
      console.log(`[ExpoFileSystemProvider] ✅ Found ${matches.length} match(es), using newest: ${bestMatch.file} (mtime: ${bestMatch.mtime})`);
      if (matches.length > 1) {
        console.log(`[ExpoFileSystemProvider] 📋 Other matches: ${matches.slice(1).map(m => `${m.file} (mtime: ${m.mtime})`).join(', ')}`);
      }
      
      // Log the actual data being returned for debugging
      const responseData = bestMatch.mockData?.response?.data;
      if (responseData && typeof responseData === 'object' && 'name' in responseData) {
        console.log(`[ExpoFileSystemProvider] 📦 Returning data with name: "${responseData.name}"`);
      }
      
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

    console.log(`[ExpoFileSystemProvider] ⚠️ No exact match found`);
    return undefined;
  }

  async findAllForSimilarMatch(request: StoredRequest): Promise<CachedMockData[]> {
    // CRITICAL: Never try to match sync endpoint requests - they should never be mocked
    const requestUrl = request?.url || '';
    if (requestUrl.includes('/mockifyer-save') || 
        requestUrl.includes('/mockifyer-clear') || 
        requestUrl.includes('/mockifyer-sync')) {
      console.log(`[ExpoFileSystemProvider] ⚠️ Skipping findAllForSimilarMatch - request URL is a sync endpoint: ${requestUrl}`);
      return [];
    }
    
    const files = await this.listMockFiles();
    const results: CachedMockData[] = [];

    for (const file of files) {
      try {
        const filePath = this.mockDataPath + '/' + file;
        const fileContent = await this.FileSystem.readAsStringAsync(filePath);
        
        // CRITICAL: Skip corrupted files that contain Mockifyer sync endpoint requests
        if (fileContent.includes('/mockifyer-save') || 
            fileContent.includes('/mockifyer-clear') || 
            fileContent.includes('/mockifyer-sync') ||
            fileContent.includes('Cannot save Mockifyer sync endpoint requests')) {
          console.log(`[ExpoFileSystemProvider] ⚠️ Skipping corrupted file ${file} - contains Mockifyer sync endpoint`);
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
          console.log(`[ExpoFileSystemProvider] ⚠️ Skipping corrupted file ${file} - request URL is a sync endpoint`);
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
        console.warn(`[Mockifyer] Failed to load mock file ${file}:`, error);
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
    const results: MockData[] = [];

    for (const file of files) {
      try {
        const filePath = this.mockDataPath + '/' + file;
        const fileContent = await this.FileSystem.readAsStringAsync(filePath);
        const mockData: MockData = JSON.parse(fileContent);
        results.push(mockData);
      } catch (error) {
        console.warn(`[Mockifyer] Failed to load mock file ${file}:`, error);
      }
    }

    return results;
  }

  /**
   * List all JSON files in the mock data directory
   */
  private async listMockFiles(): Promise<string[]> {
    try {
      console.log(`[ExpoFileSystemProvider] listMockFiles - Reading directory: ${this.mockDataPath}`);
      const dirInfo = await this.FileSystem.getInfoAsync(this.mockDataPath);
      if (!dirInfo.exists || !dirInfo.isDirectory) {
        console.log(`[ExpoFileSystemProvider] listMockFiles - Directory does not exist or is not a directory`);
        return [];
      }

      const files = await this.FileSystem.readDirectoryAsync(this.mockDataPath);
      const jsonFiles = files.filter((file: string) => file.endsWith('.json'));
      console.log(`[ExpoFileSystemProvider] listMockFiles - Found ${jsonFiles.length} JSON files:`, jsonFiles);
      return jsonFiles;
    } catch (error) {
      console.warn(`[Mockifyer] Failed to list mock files:`, error);
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
      console.log(`[ExpoFileSystemProvider] clearAll - Deleting ${files.length} mock files`);
      
      for (const file of files) {
        const filePath = this.mockDataPath + '/' + file;
        try {
          await this.FileSystem.deleteAsync(filePath, { idempotent: true });
          console.log(`[ExpoFileSystemProvider] ✅ Deleted: ${file}`);
        } catch (error) {
          console.warn(`[ExpoFileSystemProvider] Failed to delete ${file}:`, error);
        }
      }
      
      // Clear cache after deleting files
      this.fileCache.clear();
      
      console.log(`[ExpoFileSystemProvider] ✅ Cleared all mock files`);
    } catch (error) {
      console.error(`[ExpoFileSystemProvider] ❌ Error clearing mock files:`, error);
      throw error;
    }
  }
}


