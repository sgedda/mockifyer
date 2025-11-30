import fs from 'fs';
import path from 'path';
import { MockData, StoredRequest } from '../types';
import { CachedMockData, generateRequestKey } from '../utils/mock-matcher';
import { DatabaseProvider, DatabaseProviderConfig } from './types';

/**
 * Filesystem-based provider (current default implementation)
 * Stores mock data as JSON files in a directory
 */
export class FilesystemProvider implements DatabaseProvider {
  private mockDataPath: string;

  constructor(config: DatabaseProviderConfig) {
    if (!config.path) {
      throw new Error('FilesystemProvider requires a path in config');
    }
    this.mockDataPath = config.path;
  }

  initialize(): void {
    if (!fs.existsSync(this.mockDataPath)) {
      fs.mkdirSync(this.mockDataPath, { recursive: true });
    }
  }

  save(mockData: MockData): void {
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
    const filePath = path.join(this.mockDataPath, filename);
    
    // Write to file
    fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
    console.log(`[Mockifyer] Saved new mock to file: ${filename}`);
  }

  findExactMatch(request: StoredRequest, requestKey: string): CachedMockData | undefined {
    if (!fs.existsSync(this.mockDataPath)) {
      return undefined;
    }

    const files = fs.readdirSync(this.mockDataPath)
      .filter(file => file.endsWith('.json'));

    for (const file of files) {
      try {
        const filePath = path.join(this.mockDataPath, file);
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
    if (!fs.existsSync(this.mockDataPath)) {
      return [];
    }

    const files = fs.readdirSync(this.mockDataPath)
      .filter(file => file.endsWith('.json'));

    const results: CachedMockData[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(this.mockDataPath, file);
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
    if (!fs.existsSync(this.mockDataPath)) {
      return [];
    }

    const files = fs.readdirSync(this.mockDataPath)
      .filter(file => file.endsWith('.json'));

    const results: MockData[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(this.mockDataPath, file);
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

