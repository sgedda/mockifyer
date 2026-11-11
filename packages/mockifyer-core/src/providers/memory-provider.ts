import { MockData, StoredRequest } from '../types';
import { mockPassesThroughToRealApi } from '../utils/mock-passthrough';
import { mockShouldBeIncludedInRequestMatch } from '../utils/mock-replay-mode';
import { CachedMockData, generateRequestKey } from '../utils/mock-matcher';
import { DatabaseProvider, DatabaseProviderConfig, SaveMockOptions } from './types';

/**
 * In-memory provider for React Native/Expo and other environments without filesystem access.
 * Stores mock data in memory - data is lost when the app restarts.
 * Perfect for development, testing, and browser scenarios.
 * 
 * Supports preloading fixtures via:
 * - `config.options.fixtures` array (loaded in constructor)
 * - `seed(fixtures)` method (load after construction)
 */
export class MemoryProvider implements DatabaseProvider {
  private mocks: Map<string, MockData> = new Map();
  private mockCounter: number = 0;

  constructor(config: DatabaseProviderConfig) {
    // Load fixtures if provided
    const fixtures = (config.options as { fixtures?: MockData[] })?.fixtures;
    if (Array.isArray(fixtures) && fixtures.length > 0) {
      this.seed(fixtures);
      console.log(`[Mockifyer] MemoryProvider preloaded ${fixtures.length} fixtures`);
    }
  }

  initialize(): void {
    // Nothing to initialize for in-memory storage
    console.log(`[Mockifyer] MemoryProvider initialized (in-memory storage, ${this.mocks.size} mocks loaded)`);
  }

  /**
   * Preload mock fixtures into memory. Accepts the same JSON format as filesystem provider saves.
   * Call this after construction to seed the provider with recorded mocks.
   * 
   * @example
   * ```ts
   * import rates from './mock-data/default/api.frankfurter.dev/v1/latest.json';
   * 
   * const provider = new MemoryProvider({ options: {} });
   * provider.seed([rates]);
   * ```
   */
  seed(fixtures: MockData[]): void {
    let loaded = 0;
    for (const mockData of fixtures) {
      if (!mockData || !mockData.request) {
        console.warn('[Mockifyer] MemoryProvider.seed: skipping invalid fixture (missing request)');
        continue;
      }
      const requestKey = generateRequestKey(mockData.request);
      this.mocks.set(requestKey, mockData);
      loaded++;
    }
    this.mockCounter += loaded;
    console.log(`[Mockifyer] MemoryProvider seeded ${loaded} fixtures (total: ${this.mocks.size})`);
  }

  save(mockData: MockData, _options?: SaveMockOptions): void {
    const requestKey = generateRequestKey(mockData.request);
    this.mocks.set(requestKey, mockData);
    this.mockCounter++;
    console.log(`[Mockifyer] Saved mock to memory: ${requestKey.substring(0, 100)}... (Total: ${this.mockCounter})`);
  }

  findExactMatch(
    request: StoredRequest,
    requestKey: string,
    options?: { includePassthroughMocks?: boolean }
  ): CachedMockData | undefined {
    const includePassthroughMocks = options?.includePassthroughMocks === true;
    const mockData = this.mocks.get(requestKey);
    
    if (!mockData) {
      return undefined;
    }

    const filename = `memory/${requestKey.substring(0, 64)}.json`;
    if (!mockShouldBeIncludedInRequestMatch(mockData, { includePassthroughMocks, filename })) {
      return undefined;
    }

    return {
      mockData,
      filename,
      filePath: 'memory://' // Virtual path for compatibility
    };
  }

  findAllForSimilarMatch(request: StoredRequest): CachedMockData[] {
    const results: CachedMockData[] = [];
    
    try {
      const requestUrl = new URL(request.url);
      const requestPath = requestUrl.pathname;
      const requestMethod = (request.method || 'GET').toUpperCase();

      for (const [key, mockData] of this.mocks.entries()) {
        try {
          const mockUrl = new URL(mockData.request.url);
          const mockPath = mockUrl.pathname;
          const mockMethod = (mockData.request.method || 'GET').toUpperCase();
          
          if (mockPath === requestPath && mockMethod === requestMethod) {
            if (!mockPassesThroughToRealApi(mockData)) {
              results.push({
                mockData,
                filename: `memory/${key.substring(0, 64)}.json`,
                filePath: 'memory://'
              });
            }
          }
        } catch (e) {
          // Invalid URL, skip
          continue;
        }
      }
    } catch (e) {
      // Invalid request URL, return empty
      return [];
    }

    // Sort by timestamp descending (most recent first)
    return results.sort((a, b) => {
      const timeA = new Date(a.mockData.timestamp).getTime();
      const timeB = new Date(b.mockData.timestamp).getTime();
      return timeB - timeA;
    });
  }

  exists(requestKey: string): boolean {
    return this.mocks.has(requestKey);
  }

  getAll(): MockData[] {
    return Array.from(this.mocks.values()).sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA; // Most recent first
    });
  }

  /**
   * Clear all stored mocks (useful for testing)
   */
  clear(): void {
    this.mocks.clear();
    this.mockCounter = 0;
    console.log('[Mockifyer] MemoryProvider cleared all mocks');
  }

  /**
   * Clear all stored mocks (alias for clear() to match DatabaseProvider interface)
   */
  clearAll(): void {
    this.clear();
  }

  /**
   * Get the number of stored mocks
   */
  size(): number {
    return this.mocks.size;
  }
}


