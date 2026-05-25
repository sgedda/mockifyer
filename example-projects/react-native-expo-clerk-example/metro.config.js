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

let useSource =
  process.env.MOCKIFYER_USE_SOURCE === 'true' || process.env.MOCKIFYER_USE_SOURCE === '1';

if (useSource && !isUsingLocalPackages) {
  console.warn(
    '[Metro] MOCKIFYER_USE_SOURCE requires local file: packages — falling back to dist/',
  );
  useSource = false;
}

const MOCKIFYER_SOURCE_ENTRIES = {
  '@sgedda/mockifyer-core': 'src/index.react-native.ts',
  '@sgedda/mockifyer-fetch': 'src/react-native.ts',
};

function getMockifyerCorePath() {
  if (isUsingLocalPackages) {
    return path.resolve(__dirname, '../../packages/mockifyer-core');
  }
  return path.resolve(__dirname, 'node_modules/@sgedda/mockifyer-core');
}

function getMockifyerFetchPath() {
  if (isUsingLocalPackages) {
    return path.resolve(__dirname, '../../packages/mockifyer-fetch');
  }
  return path.resolve(__dirname, 'node_modules/@sgedda/mockifyer-fetch');
}

function getFetchSubpathMap() {
  if (useSource) {
    return {
      'react-native': 'src/react-native.ts',
      'metro-config': 'src/metro-config.ts',
      'metro-sync-middleware': 'src/metro-sync-middleware.ts',
      'test-generation-hook': 'src/test-generation-hook.ts',
      'metro-polyfills/empty-module': 'metro-polyfills/empty-module.js',
    };
  }
  return {
    'react-native': 'dist/react-native.js',
    'metro-config': 'dist/metro-config.js',
    'metro-sync-middleware': 'dist/metro-sync-middleware.js',
    'test-generation-hook': 'dist/test-generation-hook.js',
    'metro-polyfills/empty-module': 'metro-polyfills/empty-module.js',
  };
}

function loadConfigureMetroForMockifyer() {
  const mockifyerFetchPath = getMockifyerFetchPath();
  // metro.config.js runs in Node — always load the compiled helper (dynamic requires inside
  // metro-config.ts break under ts-node). App bundle code still resolves to src/ when useSource.
  const metroConfig = require(path.join(mockifyerFetchPath, 'dist/metro-config.js'));
  return metroConfig.configureMetroForMockifyer;
}

// Try to require Mockifyer Metro config helper (may fail if package not installed yet)
let configureMetroForMockifyer;
try {
  configureMetroForMockifyer = loadConfigureMetroForMockifyer();
} catch (e) {
  // Package not installed yet - will be resolved by Metro resolver
  console.warn('[Metro] Mockifyer package not found, skipping Metro config helper');
}

// If using local packages, configure Metro to watch and resolve them
if (isUsingLocalPackages) {
  console.log('[Metro] Using LOCAL Mockifyer packages');
  if (useSource) {
    console.log('[Metro] Mockifyer bundle: SOURCE (packages/*/src — no tsc rebuild for app code)');
  } else {
    console.log('[Metro] Mockifyer bundle: DIST (packages/*/dist — run tsc or npm run watch in packages)');
  }

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
// Also sets up sync middleware for Hybrid Provider (saves files to project folder)
// And enables auto-sync for ExpoFileSystem Provider (polling-based sync from device to project folder)
if (configureMetroForMockifyer) {
  config = configureMetroForMockifyer(config, {
    syncMiddleware: {
      projectRoot: __dirname,
      mockDataPath: './mock-data',
      testGeneration: {
        enabled: process.env.MOCKIFYER_GENERATE_TESTS === 'true',
        framework: 'jest',
        outputPath: './tests/generated',
        groupBy: 'endpoint',
        uniqueTestsPerEndpoint: true,
      },
    },
    autoSync: {
      enabled: true,
      intervalMs: 5000,
      projectRoot: __dirname,
      mockDataPath: './mock-data',
    },
  });
  console.log('[Metro] ✅ Mockifyer configured: FS stubbing + sync middleware + auto-sync');
}

// Custom resolver to handle @babel/runtime and Mockifyer packages
const defaultResolver = config.resolver.resolveRequest;
const fetchSubpathMap = getFetchSubpathMap();

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

  // Bundle Mockifyer packages from TypeScript source (MOCKIFYER_USE_SOURCE=true)
  if (useSource && MOCKIFYER_SOURCE_ENTRIES[moduleName]) {
    const pkgRoot =
      moduleName === '@sgedda/mockifyer-core'
        ? getMockifyerCorePath()
        : getMockifyerFetchPath();
    const filePath = path.join(pkgRoot, MOCKIFYER_SOURCE_ENTRIES[moduleName]);
    if (fs.existsSync(filePath)) {
      return {
        filePath,
        type: 'sourceFile',
      };
    }
  }

  // Handle Mockifyer subpath exports (e.g., @sgedda/mockifyer-fetch/react-native)
  if (moduleName.startsWith('@sgedda/mockifyer-fetch/')) {
    const subpath = moduleName.replace('@sgedda/mockifyer-fetch/', '');
    const packagePath = getMockifyerFetchPath();

    if (fetchSubpathMap[subpath]) {
      const filePath = path.join(packagePath, fetchSubpathMap[subpath]);
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

// Note: Sync middleware and auto-sync are now automatically set up by configureMetroForMockifyer above
// - syncMiddleware: Used by Hybrid Provider for instant HTTP sync
// - autoSync: Used by ExpoFileSystem Provider for polling-based sync from device to project folder

module.exports = config;
