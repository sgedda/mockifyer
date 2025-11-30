export * from './types';
export * from './filesystem-provider';
export * from './sqlite-provider';
export * from './memory-provider';
export * from './expo-filesystem-provider';

import { DatabaseProvider, DatabaseProviderConfig } from './types';
import { FilesystemProvider } from './filesystem-provider';
import { SQLiteProvider } from './sqlite-provider';
import { MemoryProvider } from './memory-provider';
import { ExpoFileSystemProvider } from './expo-filesystem-provider';

export type ProviderType = 'filesystem' | 'sqlite' | 'memory' | 'expo-filesystem';

/**
 * Create a database provider based on type and config
 * 
 * ⚠️ NOTE: Database providers other than 'filesystem' are not yet available for use.
 * This function exists for future use. Only 'filesystem' provider is currently supported.
 */
export function createProvider(
  type: ProviderType,
  config: DatabaseProviderConfig
): DatabaseProvider {
  // Only filesystem provider is currently available
  if (type !== 'filesystem') {
    throw new Error(
      `Database provider type '${type}' is not yet available for use. ` +
      `Only 'filesystem' provider is currently supported. ` +
      `Database providers (SQLite, Memory, Expo) are planned for future releases.`
    );
  }
  
  // Currently only filesystem is supported - other providers exist but are disabled
  return new FilesystemProvider(config);
  
  // Future providers (code exists but disabled):
  // case 'sqlite': return new SQLiteProvider(config);
  // case 'memory': return new MemoryProvider(config);
  // case 'expo-filesystem': return new ExpoFileSystemProvider(config);
}

