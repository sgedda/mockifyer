/**
 * Metro bundler configuration helper for Mockifyer
 * 
 * This helper configures Metro to stub Node.js built-in modules that aren't
 * available in React Native, allowing Mockifyer to bundle successfully.
 * Optionally sets up sync middleware for Hybrid Provider.
 * 
 * @example Basic usage (fs stubbing only):
 * ```javascript
 * const { getDefaultConfig } = require('expo/metro-config');
 * const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');
 * 
 * const config = getDefaultConfig(__dirname);
 * module.exports = configureMetroForMockifyer(config);
 * ```
 * 
 * @example With sync middleware (for Hybrid Provider):
 * ```javascript
 * const { getDefaultConfig } = require('expo/metro-config');
 * const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');
 * 
 * const config = getDefaultConfig(__dirname);
 * module.exports = configureMetroForMockifyer(config, {
 *   syncMiddleware: {
 *     projectRoot: __dirname,
 *     mockDataPath: './mock-data',
 *   },
 * });
 * ```
 * 
 * @example With auto-sync (for ExpoFileSystem Provider - syncs files from device to project folder):
 * ```javascript
 * const { getDefaultConfig } = require('expo/metro-config');
 * const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');
 * 
 * const config = getDefaultConfig(__dirname);
 * module.exports = configureMetroForMockifyer(config, {
 *   autoSync: {
 *     enabled: true,
 *     intervalMs: 5000,
 *     projectRoot: __dirname,
 *     mockDataPath: './mock-data',
 *   },
 * });
 * ```
 */

import type { MetroSyncMiddlewareOptions } from './metro-sync-middleware';
import { logger } from '@sgedda/mockifyer-core';

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
 * Options for configuring Metro for Mockifyer
 */
export interface ConfigureMetroOptions {
  /** Sync middleware options - if provided, sets up Hybrid Provider sync */
  syncMiddleware?: MetroSyncMiddlewareOptions;
  /** Auto-sync options - Required when using ExpoFileSystem Provider to sync files from device to project folder for code search. Not needed with Hybrid Provider (uses instant HTTP sync). */
  autoSync?: {
    /** Enable auto-sync (default: false). Set to true if using ExpoFileSystem Provider and want files in project folder for code search */
    enabled?: boolean;
    /** Sync interval in milliseconds (default: 5000) */
    intervalMs?: number;
    /** Project root directory (default: process.cwd()) */
    projectRoot?: string;
    /** Mock data path (default: 'mock-data') */
    mockDataPath?: string;
  };
}

/**
 * Configure Metro bundler for Mockifyer
 * 
 * This function:
 * 1. Adds resolver configuration to stub Node.js built-in modules (fs, path, assert, util)
 * 2. Optionally sets up sync middleware for Hybrid Provider (if syncMiddleware options provided)
 * 3. Optionally sets up auto-sync polling (if autoSync options provided - needed for ExpoFileSystem Provider, not needed with Hybrid Provider)
 * 
 * @param config - Existing Metro config (e.g., from getDefaultConfig)
 * @param options - Optional configuration including sync middleware setup
 * @returns Metro config with Mockifyer configuration merged in
 * 
 * @example Basic usage (fs stubbing only):
 * ```javascript
 * const { getDefaultConfig } = require('expo/metro-config');
 * const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');
 * 
 * const config = getDefaultConfig(__dirname);
 * module.exports = configureMetroForMockifyer(config);
 * ```
 * 
 * @example With sync middleware (for Hybrid Provider):
 * ```javascript
 * const { getDefaultConfig } = require('expo/metro-config');
 * const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');
 * 
 * const config = getDefaultConfig(__dirname);
 * module.exports = configureMetroForMockifyer(config, {
 *   syncMiddleware: {
 *     projectRoot: __dirname,
 *     mockDataPath: './mock-data',
 *   },
 * });
 * ```
 * 
 * @example With auto-sync (for ExpoFileSystem Provider - syncs files from device to project folder):
 * ```javascript
 * const { getDefaultConfig } = require('expo/metro-config');
 * const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');
 * 
 * const config = getDefaultConfig(__dirname);
 * module.exports = configureMetroForMockifyer(config, {
 *   autoSync: {
 *     enabled: true,
 *     intervalMs: 5000,
 *     projectRoot: __dirname,
 *     mockDataPath: './mock-data',
 *   },
 * });
 * ```
 */
export function configureMetroForMockifyer(
  config: MetroConfig,
  options?: ConfigureMetroOptions
): MetroConfig {
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

  // Set up sync middleware if options provided
  if (options?.syncMiddleware) {
    try {
      const { createMockSyncMiddleware } = require('./metro-sync-middleware');
      const syncMiddleware = createMockSyncMiddleware({
        projectRoot: options.syncMiddleware.projectRoot || process.cwd(),
        mockDataPath: options.syncMiddleware.mockDataPath || 'mock-data',
        testGeneration: options.syncMiddleware.testGeneration,
      });

      // Add middleware to server config
      // Expo Metro uses enhanceMiddleware, but also supports middleware array
      config.server = config.server || {};
      
      // Use enhanceMiddleware if available (Expo Metro standard)
      // enhanceMiddleware receives existing middleware and returns new middleware
      const existingEnhance = config.server.enhanceMiddleware;
      config.server.enhanceMiddleware = (middleware: any) => {
        // Return a middleware function that runs our syncMiddleware first,
        // then calls the existing enhanced middleware
        return (req: any, res: any, next: any) => {
          // Try our middleware first (it calls next() if not handling the request)
          syncMiddleware(req, res, (err?: any) => {
            if (err) {
              return next(err);
            }
            // If our middleware didn't handle it, call the existing middleware
            if (!res.headersSent) {
              return middleware(req, res, next);
            }
          });
        };
      };
    } catch (e) {
      logger.warn('[Metro] Could not set up Mockifyer sync middleware:', e);
    }
  }

  // Set up auto-sync (polling-based sync from iOS Simulator to project folder) if options provided
  // Required when using ExpoFileSystem Provider to sync files from device to project folder for code search
  // Not needed with Hybrid Provider (uses instant HTTP sync via syncMiddleware)
  if (options?.autoSync?.enabled) {
    try {
      const { startAutoSync } = require('./metro-sync-middleware');
      const intervalMs = options.autoSync.intervalMs || 5000;
      const projectRoot = options.autoSync.projectRoot || process.cwd();
      const mockDataPath = options.autoSync.mockDataPath || 'mock-data';

      startAutoSync(intervalMs, {
        projectRoot,
        mockDataPath,
      });
      console.log(`[Metro] ✅ Auto-sync enabled: polling every ${intervalMs}ms`);
    } catch (e) {
      logger.warn('[Metro] Could not set up Mockifyer auto-sync:', e);
    }
  }

  // Merge config with new resolver
  return {
    ...config,
    resolver: {
      ...existingResolver,
      resolveRequest: newResolveRequest,
    },
  };
}
