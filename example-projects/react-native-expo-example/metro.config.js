// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

// Get the default Metro config
let config = getDefaultConfig(__dirname);

// Enable package exports support if available (helps Metro resolve packages with exports fields)
if (config.resolver && !config.resolver.unstable_enablePackageExports) {
  config.resolver.unstable_enablePackageExports = true;
}

// Check if we're using local packages (file: paths)
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
const isUsingLocalPackages = 
  packageJson.dependencies['@sgedda/mockifyer-core']?.startsWith('file:') ||
  packageJson.dependencies['@sgedda/mockifyer-fetch']?.startsWith('file:');

// Helper function to resolve Mockifyer package path
function getMockifyerFetchPath() {
  if (isUsingLocalPackages) {
    return path.resolve(__dirname, '../../packages/mockifyer-fetch');
  }
  return path.resolve(__dirname, 'node_modules/@sgedda/mockifyer-fetch');
}

// Try to require Mockifyer helpers (may fail if package not installed yet)
let createMockSyncMiddleware, startAutoSync, configureMetroForMockifyer;
try {
  const mockifyerFetchPath = getMockifyerFetchPath();
  const metroSyncMiddleware = require(path.join(mockifyerFetchPath, 'dist/metro-sync-middleware.js'));
  const metroConfig = require(path.join(mockifyerFetchPath, 'dist/metro-config.js'));
  createMockSyncMiddleware = metroSyncMiddleware.createMockSyncMiddleware;
  startAutoSync = metroSyncMiddleware.startAutoSync;
  configureMetroForMockifyer = metroConfig.configureMetroForMockifyer;
} catch (e) {
  // Package not installed yet - will be resolved by Metro resolver
  console.warn('[Metro] Mockifyer package not found, skipping Metro config helpers');
}

// If using local packages, configure Metro to watch and resolve them
if (isUsingLocalPackages) {
  console.log('[Metro] Using LOCAL Mockifyer packages');
  
  // Add watchFolders to include the monorepo packages
  config.watchFolders = [
    ...(config.watchFolders || []),
    path.resolve(__dirname, '../../packages/mockifyer-core'),
    path.resolve(__dirname, '../../packages/mockifyer-fetch'),
  ];

  // Ensure Metro can resolve the local packages
  config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules || {}),
    '@sgedda/mockifyer-core': path.resolve(__dirname, '../../packages/mockifyer-core'),
    '@sgedda/mockifyer-fetch': path.resolve(__dirname, '../../packages/mockifyer-fetch'),
  };

  // Configure resolver to look in node_modules for dependencies
  config.resolver.nodeModulesPaths = [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(__dirname, '../../node_modules'),
  ];
} else {
  console.log('[Metro] Using PUBLISHED Mockifyer packages');
  // Ensure Metro can find published packages in node_modules
  // This helps Metro resolve packages with exports fields
  config.resolver.nodeModulesPaths = [
    path.resolve(__dirname, 'node_modules'),
    ...(config.resolver.nodeModulesPaths || []),
  ];
  // Explicitly map packages to help Metro resolve them
  // This is especially helpful for packages with exports fields
  config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules || {}),
    '@sgedda/mockifyer-core': path.resolve(__dirname, 'node_modules/@sgedda/mockifyer-core'),
    '@sgedda/mockifyer-fetch': path.resolve(__dirname, 'node_modules/@sgedda/mockifyer-fetch'),
  };
  // Add node_modules to watchFolders to ensure Metro indexes packages
  // This helps Metro discover and index files in node_modules
  config.watchFolders = [
    ...(config.watchFolders || []),
    path.resolve(__dirname, 'node_modules/@sgedda/mockifyer-core'),
    path.resolve(__dirname, 'node_modules/@sgedda/mockifyer-fetch'),
  ];
}

// Configure Metro for Mockifyer (stubs Node.js built-ins: fs, path, assert, util)
if (configureMetroForMockifyer) {
  config = configureMetroForMockifyer(config);
}

// Custom resolver to handle @babel/runtime and Mockifyer packages
const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle @babel/runtime resolution - always resolve from project node_modules
  if (moduleName.startsWith('@babel/runtime')) {
    const babelRuntimePath = path.resolve(__dirname, 'node_modules', moduleName);
    if (fs.existsSync(babelRuntimePath)) {
      return {
        filePath: babelRuntimePath,
        type: 'sourceFile',
      };
    }
  }
  
  // For main Mockifyer package, let Metro's default resolver handle it
  // We've added it to extraNodeModules and watchFolders, so Metro should discover and index it
  // Metro will automatically respect the "react-native" field in package.json
  // We don't intercept it to avoid SHA-1 indexing issues
  
  // Handle Mockifyer subpath exports (e.g., @sgedda/mockifyer-fetch/react-native)
  if (moduleName.startsWith('@sgedda/mockifyer-fetch/')) {
    const subpath = moduleName.replace('@sgedda/mockifyer-fetch/', '');
    const packagePath = getMockifyerFetchPath();
    
    // Map subpaths to their dist files
    const subpathMap = {
      'react-native': 'dist/react-native.js',
      'metro-config': 'dist/metro-config.js',
      'metro-sync-middleware': 'dist/metro-sync-middleware.js',
      'test-generation-hook': 'dist/test-generation-hook.js',
      'metro-polyfills/empty-module': 'metro-polyfills/empty-module.js',
    };
    
    if (subpathMap[subpath]) {
      const filePath = path.join(packagePath, subpathMap[subpath]);
      if (fs.existsSync(filePath)) {
        return {
          filePath,
          type: 'sourceFile',
        };
      }
    }
    
    // Try require.resolve as fallback
    try {
      const resolvedPath = require.resolve(moduleName);
      return {
        filePath: resolvedPath,
        type: 'sourceFile',
      };
    } catch (e) {
      // Will fall through to default resolver
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

// Add mock sync middleware (only if available)
if (createMockSyncMiddleware && startAutoSync) {
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
}

module.exports = config;