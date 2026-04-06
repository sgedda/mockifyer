import { MockData, StoredRequest } from '../types';
import { CachedMockData } from '../utils/mock-matcher';

/** Optional hints when saving (e.g. Metro sync project → device preserves on-disk paths). */
export interface SaveMockOptions {
  /** Path relative to scenario root (e.g. host/rest/.../POST_foo_2026-01-01_12-00-00.json). */
  relativePath?: string;
}

/**
 * Configuration for database providers
 */
export interface DatabaseProviderConfig {
  /** Path or connection string for the database */
  path?: string;
  /** Additional provider-specific options */
  options?: Record<string, any>;
  /** Metro port for hybrid provider (defaults to 8081) */
  metroPort?: number;
}

/**
 * Interface for database providers that store and retrieve mock data
 */
export interface DatabaseProvider {
  /**
   * Initialize the provider (e.g., create tables, ensure directory exists)
   */
  initialize(): Promise<void> | void;

  /**
   * Save mock data to the database
   */
  save(mockData: MockData, options?: SaveMockOptions): Promise<void> | void;

  /**
   * Find exact match for a request
   */
  findExactMatch(request: StoredRequest, requestKey: string): Promise<CachedMockData | undefined> | CachedMockData | undefined;

  /**
   * Find all mocks for similar matching (path + method)
   */
  findAllForSimilarMatch(request: StoredRequest): Promise<CachedMockData[]> | CachedMockData[];

  /**
   * Check if a mock with the given request key already exists
   */
  exists(requestKey: string): Promise<boolean> | boolean;

  /**
   * Get all mock data (for listing/debugging)
   */
  getAll(): Promise<MockData[]> | MockData[];

  /**
   * Close/cleanup resources if needed
   */
  close?(): Promise<void> | void;

  /**
   * Clear all stored mocks (optional - not all providers support this)
   */
  clearAll?(): Promise<void> | void;
}


