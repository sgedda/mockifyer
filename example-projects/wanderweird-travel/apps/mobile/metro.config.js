// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

let config = getDefaultConfig(__dirname);

if (config.resolver && !config.resolver.unstable_enablePackageExports) {
  config.resolver.unstable_enablePackageExports = true;
}

const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
const isUsingLocalPackages =
  packageJson.dependencies['@sgedda/mockifyer-core']?.startsWith('file:') ||
  packageJson.dependencies['@sgedda/mockifyer-fetch']?.startsWith('file:');

function getMockifyerFetchPath() {
  if (isUsingLocalPackages) {
    return path.resolve(__dirname, '../../../../packages/mockifyer-fetch');
  }
  return path.resolve(__dirname, 'node_modules/@sgedda/mockifyer-fetch');
}

let configureMetroForMockifyer;
try {
  const mockifyerFetchPath = getMockifyerFetchPath();
  const metroConfig = require(path.join(mockifyerFetchPath, 'dist/metro-config.js'));
  configureMetroForMockifyer = metroConfig.configureMetroForMockifyer;
} catch (e) {
  console.warn('[Metro] Mockifyer package not found, skipping Metro config helper');
}

const sharedMockDataPath = path.resolve(__dirname, '../../mock-data');

if (isUsingLocalPackages) {
  console.log('[Metro] Using LOCAL Mockifyer packages');
  config.watchFolders = [
    ...(config.watchFolders || []),
    path.resolve(__dirname, '../../../../packages/mockifyer-core'),
    path.resolve(__dirname, '../../../../packages/mockifyer-fetch'),
    sharedMockDataPath,
  ];
  config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules || {}),
    '@sgedda/mockifyer-core': path.resolve(__dirname, '../../../../packages/mockifyer-core'),
    '@sgedda/mockifyer-fetch': path.resolve(__dirname, '../../../../packages/mockifyer-fetch'),
  };
  config.resolver.nodeModulesPaths = [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(__dirname, '../../../../node_modules'),
  ];
}

if (configureMetroForMockifyer) {
  config = configureMetroForMockifyer(config, {
    syncMiddleware: {
      projectRoot: __dirname,
      mockDataPath: sharedMockDataPath,
    },
    autoSync: {
      enabled: true,
      intervalMs: 5000,
      projectRoot: __dirname,
      mockDataPath: sharedMockDataPath,
    },
  });
  console.log('[Metro] Mockifyer configured with shared mock-data at', sharedMockDataPath);
}

const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@sgedda/mockifyer-fetch/')) {
    const subpath = moduleName.replace('@sgedda/mockifyer-fetch/', '');
    const packagePath = getMockifyerFetchPath();
    const subpathMap = {
      'react-native': 'dist/react-native.js',
      'metro-config': 'dist/metro-config.js',
      'metro-sync-middleware': 'dist/metro-sync-middleware.js',
    };
    if (subpathMap[subpath]) {
      const filePath = path.join(packagePath, subpathMap[subpath]);
      if (fs.existsSync(filePath)) {
        return { filePath, type: 'sourceFile' };
      }
    }
  }

  if (defaultResolver) {
    return defaultResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

module.exports = config;
