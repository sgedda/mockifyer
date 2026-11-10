export * from './types';
export * from './filesystem-provider';
export * from './sqlite-provider';
export * from './memory-provider';
export * from './expo-filesystem-provider';
export * from './hybrid-provider';
export * from './redis-provider';

import { DatabaseProvider, DatabaseProviderConfig } from './types';
import { FilesystemProvider } from './filesystem-provider';
import { SQLiteProvider } from './sqlite-provider';
import { MemoryProvider } from './memory-provider';
import { ExpoFileSystemProvider } from './expo-filesystem-provider';
import { HybridProvider } from './hybrid-provider';
import { RedisProvider } from './redis-provider';

export type ProviderType =
  | 'filesystem'
  | 'sqlite'
  | 'memory'
  | 'expo-filesystem'
  | 'hybrid'
  | 'redis';

/**
 * Create a database provider based on type and config.
 * `redis` requires optional peer `ioredis` and is intended for Node (`mockifyer-fetch`).
 */
export function createProvider(
  type: ProviderType,
  config: DatabaseProviderConfig
): DatabaseProvider {
  switch (type) {
    case 'filesystem':
      return new FilesystemProvider(config);
    case 'expo-filesystem':
      return new ExpoFileSystemProvider(config);
    case 'hybrid':
      return new HybridProvider(config);
    case 'memory':
      return new MemoryProvider(config);
    case 'sqlite':
      // SQLite provider exists but may not be fully tested
      return new SQLiteProvider(config);
    case 'redis':
      return new RedisProvider(config);
    default:
      throw new Error(
        `Database provider type '${type}' is not supported. ` +
        `Supported types: filesystem, expo-filesystem, hybrid, memory, sqlite, redis`
      );
  }
}

