// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { createMockSyncMiddleware, startAutoSync } = require('@sgedda/mockifyer-fetch/metro-sync-middleware');
const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');

// Get the default Metro config
let config = getDefaultConfig(__dirname);

// Add watchFolders to include the monorepo packages
// This allows Metro to watch for changes in the packages
config.watchFolders = [
  path.resolve(__dirname, '../../packages/mockifyer-core'),
  path.resolve(__dirname, '../../packages/mockifyer-fetch'),
];

// Ensure Metro can resolve the local packages
// The symlinks point to package root, and package.json "main" points to dist/index.js
config.resolver.extraNodeModules = {
  '@sgedda/mockifyer-core': path.resolve(__dirname, '../../packages/mockifyer-core'),
  '@sgedda/mockifyer-fetch': path.resolve(__dirname, '../../packages/mockifyer-fetch'),
  // Ensure @babel/runtime resolves from the example project's node_modules
  '@babel/runtime': path.resolve(__dirname, 'node_modules/@babel/runtime'),
};

// Configure resolver to look in node_modules for dependencies
// This ensures @babel/runtime and other dependencies resolve correctly
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../../node_modules'),
];

// Configure Metro for Mockifyer (stubs Node.js built-ins: fs, path, assert, util)
config = configureMetroForMockifyer(config);

// Custom resolver to handle @babel/runtime (preserved after Mockifyer config)
const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle @babel/runtime resolution - always resolve from project node_modules
  if (moduleName.startsWith('@babel/runtime')) {
    const fs = require('fs');
    const babelRuntimePath = path.resolve(__dirname, 'node_modules', moduleName);
    if (fs.existsSync(babelRuntimePath)) {
      return {
        filePath: babelRuntimePath,
        type: 'sourceFile',
      };
    }
  }
  
  // Use default resolution (includes Mockifyer's Node.js built-in stubs)
  if (defaultResolver) {
    return defaultResolver(context, moduleName, platform);
  }
  // Fallback to default Metro resolution
  return context.resolveRequest(context, moduleName, platform);
};

// Configure transformer
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

// Add mock sync middleware
// Test generation is configured here since files are saved in Metro middleware (Node.js environment)
const mockSyncMiddleware = createMockSyncMiddleware({
  projectRoot: __dirname,
  mockDataPath: 'mock-data',
  testGeneration: {
    enabled: process.env.MOCKIFYER_GENERATE_TESTS === 'true',
    framework: 'jest',
    outputPath: './tests/generated',
    groupBy: 'endpoint',
    uniqueTestsPerEndpoint: true,
  },
});

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    // Add mock sync middleware before default middleware
    return (req, res, next) => {
      // Try mock sync middleware first
      mockSyncMiddleware(req, res, (err) => {
        if (err) {
          return next(err);
        }
        // If not handled by mock sync, continue with default middleware
        if (!res.headersSent) {
          return middleware(req, res, next);
        }
      });
    };
  },
};

// Start auto-sync in development (syncs every 5 seconds)
if (process.env.NODE_ENV !== 'production') {
  startAutoSync(5000, {
    projectRoot: __dirname,
    mockDataPath: 'mock-data',
  });
}

module.exports = config;

