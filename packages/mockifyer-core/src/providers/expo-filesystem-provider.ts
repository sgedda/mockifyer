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

  constructor(config: DatabaseProviderConfig) {
    if (!config.path) {
      throw new Error('ExpoFileSystemProvider requires a path in config');
    }
    this.mockDataPath = config.path;
    
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
  }

  async save(mockData: MockData): Promise<void> {
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
    
    // Write to file (async)
    await this.FileSystem.writeAsStringAsync(
      filePath,
      JSON.stringify(mockData, null, 2)
    );
    console.log(`[Mockifyer] Saved new mock to file: ${filename}`);
  }

  async findExactMatch(request: StoredRequest, requestKey: string): Promise<CachedMockData | undefined> {
    const files = await this.listMockFiles();
    
    for (const file of files) {
      try {
        const filePath = this.mockDataPath + '/' + file;
        const fileContent = await this.FileSystem.readAsStringAsync(filePath);
        const mockData: MockData = JSON.parse(fileContent);
        
        if (!mockData?.request || typeof mockData.request !== 'object') {
          continue;
        }

        // Generate key for this mock and compare with requested key
        const mockKey = generateRequestKey(mockData.request);
        if (mockKey === requestKey) {
          return {
            mockData,
            filename: file,
            filePath: filePath
          };
        }
      } catch (error) {
        console.warn(`[Mockifyer] Failed to load mock file ${file}:`, error);
      }
    }

    return undefined;
  }

  async findAllForSimilarMatch(request: StoredRequest): Promise<CachedMockData[]> {
    const files = await this.listMockFiles();
    const results: CachedMockData[] = [];

    for (const file of files) {
      try {
        const filePath = this.mockDataPath + '/' + file;
        const fileContent = await this.FileSystem.readAsStringAsync(filePath);
        const mockData: MockData = JSON.parse(fileContent);
        
        if (!mockData?.request || typeof mockData.request !== 'object') {
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
      const dirInfo = await this.FileSystem.getInfoAsync(this.mockDataPath);
      if (!dirInfo.exists || !dirInfo.isDirectory) {
        return [];
      }

      const files = await this.FileSystem.readDirectoryAsync(this.mockDataPath);
      return files.filter((file: string) => file.endsWith('.json'));
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
}


