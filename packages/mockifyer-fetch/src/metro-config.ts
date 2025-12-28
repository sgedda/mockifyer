/**
 * Metro bundler configuration helper for Mockifyer
 * 
 * This helper configures Metro to stub Node.js built-in modules that aren't
 * available in React Native, allowing Mockifyer to bundle successfully.
 * 
 * @example
 * ```javascript
 * const { getDefaultConfig } = require('expo/metro-config');
 * const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');
 * 
 * const config = getDefaultConfig(__dirname);
 * module.exports = configureMetroForMockifyer(config);
 * ```
 */

// Metro config types (simplified - Metro doesn't export types)
export interface MetroConfig {
  resolver?: {
    resolveRequest?: (
      context: any,
      moduleName: string,
      platform: string | null
    ) => { filePath: string; type: string } | null | undefined;
    extraNodeModules?: Record<string, string>;
    nodeModulesPaths?: string[];
  };
  watchFolders?: string[];
  transformer?: any;
  server?: any;
  [key: string]: any;
}

/**
 * Node.js built-in modules that need to be stubbed for React Native
 * Includes modules used by Mockifyer packages and their dependencies:
 * - fs, path: Used by FilesystemProvider
 * - assert: Used by @sinonjs/fake-timers
 * - util: Used by @sinonjs/fake-timers
 */
const NODE_BUILTINS = ['fs', 'path', 'assert', 'util'] as const;

/**
 * Configure Metro bundler for Mockifyer
 * 
 * This function adds resolver configuration to stub Node.js built-in modules
 * that aren't available in React Native. The stubs are empty modules that
 * allow Metro to bundle successfully while the code gracefully handles
 * their absence at runtime.
 * 
 * @param config - Existing Metro config (e.g., from getDefaultConfig)
 * @returns Metro config with Mockifyer resolver configuration merged in
 * 
 * @example
 * ```javascript
 * const { getDefaultConfig } = require('expo/metro-config');
 * const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');
 * 
 * const config = getDefaultConfig(__dirname);
 * module.exports = configureMetroForMockifyer(config);
 * ```
 */
export function configureMetroForMockifyer(config: MetroConfig): MetroConfig {
  // Get path to empty module stub
  // Resolve using the package export path, which points to metro-polyfills/empty-module.js
  let emptyModulePath: string;
  try {
    // Try to resolve via package exports (works when installed)
    emptyModulePath = require.resolve('@sgedda/mockifyer-fetch/metro-polyfills/empty-module');
  } catch (e) {
    // Fallback: resolve relative to this file (works in monorepo/development)
    const path = require('path');
    emptyModulePath = path.join(__dirname, '..', 'metro-polyfills', 'empty-module.js');
  }

  // Get existing resolver or create new one
  const existingResolver = config.resolver || {};
  const existingResolveRequest = existingResolver.resolveRequest;

  // Create new resolveRequest function that handles Node.js built-ins
  const newResolveRequest = (
    context: any,
    moduleName: string,
    platform: string | null
  ): { filePath: string; type: string } | null | undefined => {
    // Handle Node.js built-in modules - return empty module stub
    if (NODE_BUILTINS.includes(moduleName as any)) {
      return {
        filePath: emptyModulePath,
        type: 'sourceFile',
      };
    }

    // Call existing resolver if present
    if (existingResolveRequest) {
      const result = existingResolveRequest(context, moduleName, platform);
      if (result) {
        return result;
      }
    }

    // Fallback to default Metro resolution
    return context.resolveRequest(context, moduleName, platform);
  };

  // Merge config with new resolver
  return {
    ...config,
    resolver: {
      ...existingResolver,
      resolveRequest: newResolveRequest,
    },
  };
}

