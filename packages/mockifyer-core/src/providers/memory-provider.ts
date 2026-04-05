import { MockData, StoredRequest } from '../types';
import { CachedMockData, generateRequestKey } from '../utils/mock-matcher';
import { DatabaseProvider, DatabaseProviderConfig, SaveMockOptions } from './types';

/**
 * In-memory provider for React Native/Expo and other environments without filesystem access
 * Stores mock data in memory - data is lost when the app restarts
 * Perfect for development and testing scenarios
 */
export class MemoryProvider implements DatabaseProvider {
  private mocks: Map<string, MockData> = new Map();
  private mockCounter: number = 0;

  constructor(config: DatabaseProviderConfig) {
    // Memory provider doesn't need any config, but we accept it for consistency
  }

  initialize(): void {
    // Nothing to initialize for in-memory storage
    console.log('[Mockifyer] MemoryProvider initialized (in-memory storage)');
  }

  save(mockData: MockData, _options?: SaveMockOptions): void {
    const requestKey = generateRequestKey(mockData.request);
    this.mocks.set(requestKey, mockData);
    this.mockCounter++;
    console.log(`[Mockifyer] Saved mock to memory: ${requestKey.substring(0, 100)}... (Total: ${this.mockCounter})`);
  }

  findExactMatch(request: StoredRequest, requestKey: string): CachedMockData | undefined {
    const mockData = this.mocks.get(requestKey);
    
    if (!mockData) {
      return undefined;
    }

    return {
      mockData,
      filename: `memory_${requestKey.substring(0, 50)}.json`,
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
            results.push({
              mockData,
              filename: `memory_${key.substring(0, 50)}.json`,
              filePath: 'memory://'
            });
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


