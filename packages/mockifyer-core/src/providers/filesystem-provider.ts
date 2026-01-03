import fs from 'fs';
import path from 'path';
import { MockData, StoredRequest } from '../types';
import { CachedMockData, generateRequestKey } from '../utils/mock-matcher';
import { DatabaseProvider, DatabaseProviderConfig } from './types';
import { getCurrentScenario, getScenarioFolderPath, ensureScenarioFolder, checkRequestLimit } from '../utils/scenario';

/**
 * Filesystem-based provider (current default implementation)
 * Stores mock data as JSON files in a directory
 * 
 * Note: This provider requires Node.js fs module and will not work in React Native.
 * For React Native, use ExpoFileSystemProvider instead.
 */
export class FilesystemProvider implements DatabaseProvider {
  private mockDataPath: string;
  private fsAvailable: boolean;

  constructor(config: DatabaseProviderConfig) {
    if (!config.path) {
      throw new Error('FilesystemProvider requires a path in config');
    }
    this.mockDataPath = config.path;
    // Check if fs is available (will be false in React Native where fs is stubbed)
    this.fsAvailable = typeof fs !== 'undefined' && typeof fs.existsSync === 'function';
    
    if (!this.fsAvailable) {
      console.warn('[Mockifyer] FilesystemProvider: Node.js fs module is not available. ' +
        'This provider requires Node.js environment. For React Native, use ExpoFileSystemProvider.');
    }
  }

  initialize(): void {
    if (!this.fsAvailable) {
      throw new Error('FilesystemProvider requires Node.js fs module. ' +
        'For React Native, use ExpoFileSystemProvider instead.');
    }
    if (!fs.existsSync(this.mockDataPath)) {
      fs.mkdirSync(this.mockDataPath, { recursive: true });
    }
    // Ensure scenario folder exists
    const currentScenario = getCurrentScenario(this.mockDataPath);
    ensureScenarioFolder(this.mockDataPath, currentScenario);
  }

  /**
   * Get the scenario-specific path for mock files
   */
  private getScenarioPath(): string {
    const currentScenario = getCurrentScenario(this.mockDataPath);
    return getScenarioFolderPath(this.mockDataPath, currentScenario);
  }

  save(mockData: MockData): void {
    if (!this.fsAvailable) {
      throw new Error('FilesystemProvider requires Node.js fs module. ' +
        'For React Native, use ExpoFileSystemProvider instead.');
    }
    
    const scenarioPath = this.getScenarioPath();
    ensureScenarioFolder(this.mockDataPath, getCurrentScenario(this.mockDataPath));
    
    // Check request limit before saving (only if limit is set via env var)
    const limitCheck = checkRequestLimit(this.mockDataPath);
    if (limitCheck.limitReached && limitCheck.error) {
      console.warn(`[Mockifyer] ⚠️ ${limitCheck.error.message}`);
      // Don't throw - just log and return to prevent app crash
      return;
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
    const filePath = path.join(scenarioPath, filename);
    
    // Write to file
    fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
    const currentScenario = getCurrentScenario(this.mockDataPath);
    console.log(`[Mockifyer] Saved new mock to file: ${currentScenario}/${filename}`);
  }

  findExactMatch(request: StoredRequest, requestKey: string): CachedMockData | undefined {
    if (!this.fsAvailable || !fs.existsSync(this.mockDataPath)) {
      return undefined;
    }

    const scenarioPath = this.getScenarioPath();
    if (!fs.existsSync(scenarioPath)) {
      return undefined;
    }

    const files = fs.readdirSync(scenarioPath)
      .filter(file => file.endsWith('.json'));

    for (const file of files) {
      try {
        const filePath = path.join(scenarioPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
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

  findAllForSimilarMatch(request: StoredRequest): CachedMockData[] {
    if (!this.fsAvailable || !fs.existsSync(this.mockDataPath)) {
      return [];
    }

    const scenarioPath = this.getScenarioPath();
    if (!fs.existsSync(scenarioPath)) {
      return [];
    }

    const files = fs.readdirSync(scenarioPath)
      .filter(file => file.endsWith('.json'));

    const results: CachedMockData[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(scenarioPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
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

  exists(requestKey: string): boolean {
    // For filesystem provider, we can't efficiently check existence by key
    // without reading all files. This will be handled by findExactMatch
    return false;
  }

  getAll(): MockData[] {
    if (!this.fsAvailable || !fs.existsSync(this.mockDataPath)) {
      return [];
    }

    const scenarioPath = this.getScenarioPath();
    if (!fs.existsSync(scenarioPath)) {
      return [];
    }

    const files = fs.readdirSync(scenarioPath)
      .filter(file => file.endsWith('.json'));

    const results: MockData[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(scenarioPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const mockData: MockData = JSON.parse(fileContent);
        results.push(mockData);
      } catch (error) {
        console.warn(`[Mockifyer] Failed to load mock file ${file}:`, error);
      }
    }

    return results;
  }
}

