/**
 * Provider barrel for React Native / Metro — excludes Node-only FilesystemProvider and SQLiteProvider
 * so nothing in this graph statically imports `fs`, `path`, or `better-sqlite3`.
 */
export * from './types';
export * from './memory-provider';
export * from './expo-filesystem-provider';
export * from './hybrid-provider';

import { DatabaseProvider, DatabaseProviderConfig } from './types';
import { MemoryProvider } from './memory-provider';
import { ExpoFileSystemProvider } from './expo-filesystem-provider';
import { HybridProvider } from './hybrid-provider';

export type ProviderType = 'filesystem' | 'sqlite' | 'memory' | 'expo-filesystem' | 'hybrid';

/**
 * Create a database provider (React Native bundle).
 * `filesystem` and `sqlite` are not available here — use the full Node package entry for those.
 */
export function createProvider(
  type: ProviderType,
  config: DatabaseProviderConfig
): DatabaseProvider {
  switch (type) {
    case 'filesystem':
      throw new Error(
        'FilesystemProvider is not included in the React Native build (uses Node fs). ' +
          'Use databaseProvider type "expo-filesystem" or "hybrid" instead.'
      );
    case 'sqlite':
      throw new Error(
        'SQLiteProvider is not included in the React Native build. ' +
          'Use "memory", "expo-filesystem", or "hybrid" in React Native.'
      );
    case 'expo-filesystem':
      return new ExpoFileSystemProvider(config);
    case 'hybrid':
      return new HybridProvider(config);
    case 'memory':
      return new MemoryProvider(config);
    default:
      throw new Error(
        `Database provider type '${type}' is not supported. ` +
          `Supported types in React Native: expo-filesystem, hybrid, memory`
      );
  }
}
