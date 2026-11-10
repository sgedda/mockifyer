// Browser entry - re-exports everything from main entry but overrides createProvider
// This lets browser builds work while blocking Node-only providers

export * from './index';

// Override createProvider to only allow memory provider in browser
import { DatabaseProvider, DatabaseProviderConfig } from './providers/types';
import { MemoryProvider } from './providers/memory-provider';

export { MemoryProvider };

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
