import fs from 'fs';
import path from 'path';
import { MockData, StoredRequest } from '../types';
import { CachedMockData, generateRequestKey } from '../utils/mock-matcher';
import { DatabaseProvider, DatabaseProviderConfig, SaveMockOptions } from './types';
import { getCurrentScenario, getScenarioFolderPath, ensureScenarioFolder, checkRequestLimit } from '../utils/scenario';
import { getCurrentDate } from '../utils/date';
import { getMockFilePath, formatDateStr } from '../utils/file-naming';
import { shouldExcludeUrl } from '../utils/url-exclusion';

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

  save(mockData: MockData, options?: SaveMockOptions): void {
    if (!this.fsAvailable) {
      throw new Error('FilesystemProvider requires Node.js fs module. ' +
        'For React Native, use ExpoFileSystemProvider instead.');
    }
    
    const requestUrl = mockData?.request?.url || '';
    if (shouldExcludeUrl(requestUrl, undefined)) {
      console.log(`[FilesystemProvider] ⚠️ Skipping save - request URL is excluded: ${requestUrl}`);
      return;
    }
    
    const scenarioPath = this.getScenarioPath();
    ensureScenarioFolder(this.mockDataPath, getCurrentScenario(this.mockDataPath));
    
    if (!options?.relativePath) {
      const limitCheck = checkRequestLimit(this.mockDataPath);
      if (limitCheck.limitReached && limitCheck.error) {
        console.warn(`[Mockifyer] ⚠️ ${limitCheck.error.message}`);
        return;
      }
    }

    let dir: string;
    let filename: string;
    if (options?.relativePath) {
      const normalized = options.relativePath.replace(/\\/g, '/').replace(/^\//, '');
      const lastSlash = normalized.lastIndexOf('/');
      dir = lastSlash >= 0 ? normalized.slice(0, lastSlash) : '';
      filename = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
    } else {
      const parts = getMockFilePath(mockData, formatDateStr(getCurrentDate()));
      dir = parts.dir;
      filename = parts.filename;
    }
    const filePath = path.join(scenarioPath, dir, filename);
    fs.mkdirSync(path.join(scenarioPath, dir), { recursive: true });

    fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
    const currentScenario = getCurrentScenario(this.mockDataPath);
    console.log(`[Mockifyer] Saved new mock to file: ${currentScenario}/${dir ? `${dir}/` : ''}${filename}`);
  }

  private getAllJsonFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.getAllJsonFiles(fullPath));
      } else if (entry.name.endsWith('.json')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  findExactMatch(request: StoredRequest, requestKey: string): CachedMockData | undefined {
    if (!this.fsAvailable || !fs.existsSync(this.mockDataPath)) {
      return undefined;
    }

    const scenarioPath = this.getScenarioPath();
    if (!fs.existsSync(scenarioPath)) {
      return undefined;
    }

    const files = this.getAllJsonFiles(scenarioPath);

    for (const filePath of files) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const mockData: MockData = JSON.parse(fileContent);

        if (!mockData?.request || typeof mockData.request !== 'object') {
          continue;
        }

        const mockKey = generateRequestKey(mockData.request);
        if (mockKey === requestKey) {
          return { mockData, filename: path.relative(scenarioPath, filePath), filePath };
        }
      } catch (error) {
        console.warn(`[Mockifyer] Failed to load mock file ${filePath}:`, error);
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

    const results: CachedMockData[] = [];

    for (const filePath of this.getAllJsonFiles(scenarioPath)) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const mockData: MockData = JSON.parse(fileContent);

        if (!mockData?.request || typeof mockData.request !== 'object') {
          continue;
        }

        try {
          const requestUrl = new URL(request.url);
          const mockUrl = new URL(mockData.request.url);
          if (mockUrl.pathname === requestUrl.pathname &&
              (mockData.request.method || 'GET').toUpperCase() === (request.method || 'GET').toUpperCase()) {
            results.push({ mockData, filename: path.relative(scenarioPath, filePath), filePath });
          }
        } catch (e) {
          continue;
        }
      } catch (error) {
        console.warn(`[Mockifyer] Failed to load mock file ${filePath}:`, error);
      }
    }

    return results;
  }

  exists(requestKey: string): boolean {
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

    const files = this.getAllJsonFiles(scenarioPath);

    const results: MockData[] = [];

    for (const filePath of files) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const mockData: MockData = JSON.parse(fileContent);
        results.push(mockData);
      } catch (error) {
        console.warn(`[Mockifyer] Failed to load mock file ${filePath}:`, error);
      }
    }

    return results;
  }
}

