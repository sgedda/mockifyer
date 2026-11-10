/**
 * Minimal browser entry - only MemoryProvider and essential types.
 * For full Node.js functionality, import from '@sgedda/mockifyer-core' (default entry).
 * 
 * This entry excludes all utilities that transitively import fs, path, crypto, buffer, or http/https.
 */

// Essential types only
export type { MockifyerConfig } from './types';
export type { MockData, StoredRequest, StoredResponse } from './types';
export type { HTTPClient, HTTPResponse } from './types/http-client';
export type { DatabaseProvider, DatabaseProviderConfig } from './providers/types';

// Memory provider only (browser-safe)
export { MemoryProvider } from './providers/memory-provider';

// Essential logger (no Node dependencies)
export * from './utils/logger';

// Create provider factory (browser version - memory only)
import { DatabaseProvider, DatabaseProviderConfig } from './providers/types';
import { MemoryProvider } from './providers/memory-provider';

/**
 * Create a database provider (browser bundle).
 * Only `memory` provider is available - filesystem/sqlite/redis require Node.js.
 */
export function createProvider(
  type: string,
  config: DatabaseProviderConfig
): DatabaseProvider {
  if (type === 'memory') {
    return new MemoryProvider(config);
  }
  throw new Error(
    `[Mockifyer Browser] Provider '${type}' requires Node.js built-ins (fs/path/crypto). ` +
    `In browser builds, only 'memory' provider is supported. ` +
    `Use: databaseProvider: { type: 'memory', options: { fixtures: [...] } }`
  );
}
