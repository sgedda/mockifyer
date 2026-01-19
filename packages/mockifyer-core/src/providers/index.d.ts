export * from './types';
export * from './filesystem-provider';
export * from './sqlite-provider';
export * from './memory-provider';
export * from './expo-filesystem-provider';
export * from './hybrid-provider';
import { DatabaseProvider, DatabaseProviderConfig } from './types';
export type ProviderType = 'filesystem' | 'sqlite' | 'memory' | 'expo-filesystem' | 'hybrid';
/**
 * Create a database provider based on type and config
 *
 * ⚠️ NOTE: Database providers other than 'filesystem' are not yet available for use.
 * This function exists for future use. Only 'filesystem' provider is currently supported.
 */
export declare function createProvider(type: ProviderType, config: DatabaseProviderConfig): DatabaseProvider;
//# sourceMappingURL=index.d.ts.map