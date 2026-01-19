# Metro Configuration for React Native

Mockifyer requires Metro bundler configuration to stub Node.js built-in modules that aren't available in React Native.

## Quick Setup

Use the provided helper function to configure Metro automatically:

### Basic Setup (FS Stubbing Only)

```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');

const config = getDefaultConfig(__dirname);
module.exports = configureMetroForMockifyer(config);
```

### With Sync Middleware (For Hybrid Provider)

If you're using the Hybrid Provider to save files to both device and project folder:

```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');

const config = getDefaultConfig(__dirname);

// One function call handles BOTH:
// 1. FS/path stubbing (for bundling)
// 2. Sync middleware (for Hybrid Provider to save files to project folder)
module.exports = configureMetroForMockifyer(config, {
  syncMiddleware: {
    projectRoot: __dirname,
    mockDataPath: './mock-data',
  },
});
```

This automatically sets up:
- ✅ Node.js module stubbing (`fs`, `path`, `assert`, `util`)
- ✅ Sync middleware for Hybrid Provider (saves files to project folder)

## Manual Setup

If you prefer manual configuration or need more control:

```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Stub Node.js built-in modules
// fs, path: Used by FilesystemProvider
// assert, util: Used by @sinonjs/fake-timers (optional dependency)
const nodeBuiltins = ['fs', 'path', 'assert', 'util'];
const defaultResolver = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (nodeBuiltins.includes(moduleName)) {
    return {
      filePath: require.resolve('@sgedda/mockifyer-fetch/metro-polyfills/empty-module'),
      type: 'sourceFile',
    };
  }
  
  if (defaultResolver) {
    return defaultResolver(context, moduleName, platform);
  }
  
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
```

## Why This Is Needed

### FS/Path Stubbing

Mockifyer packages use Node.js built-in modules (`fs`, `path`) for filesystem operations. These modules aren't available in React Native, so Metro needs to stub them during bundling. The stubs are empty modules that allow bundling to succeed while the code gracefully handles their absence at runtime.

**Note:** With conditional imports (added in recent versions), FS stubbing is optional - the code handles missing modules gracefully. However, Metro config is still recommended to prevent bundling errors.

### Sync Middleware (Optional)

If you're using the **Hybrid Provider**, you need sync middleware to save files to your project folder. The Hybrid Provider saves mocks to both:
1. Device filesystem (via Expo FileSystem)
2. Project folder (via Metro HTTP endpoint)

The sync middleware handles the Metro endpoint (`/mockifyer-save`) that writes files to your project folder.

## Modules Stubbed

- `fs` - Used by FilesystemProvider (not used in React Native - use ExpoFileSystemProvider instead)
- `path` - Used by FilesystemProvider
- `assert` - Used by @sinonjs/fake-timers (optional dependency for date manipulation)
- `util` - Used by @sinonjs/fake-timers (optional dependency for date manipulation)

## Bundle Size Impact

- **Metro config code**: 0 bytes (runs at build time, not bundled)
- **Empty module stubs**: ~10-30 bytes total (only if referenced)
- **Total impact**: Negligible (~30 bytes)

## Troubleshooting

### Error: "Unable to resolve module 'fs'"

This means the Metro config isn't set up correctly. Use the `configureMetroForMockifyer` helper or add manual stubbing as shown above.

### Error: "Cannot find module '@sgedda/mockifyer-fetch/metro-polyfills/empty-module'"

Make sure you've installed `@sgedda/mockifyer-fetch` and the package exports are configured correctly. Try:

```bash
npm install @sgedda/mockifyer-fetch
```

### Custom Metro Config Already Exists

The helper function merges with your existing config. If you have custom resolvers, they'll be preserved:

```javascript
const config = getDefaultConfig(__dirname);

// Your custom config
config.resolver.extraNodeModules = { /* ... */ };

// Add Mockifyer config (preserves your custom resolver)
module.exports = configureMetroForMockifyer(config);
```

### Files Not Appearing in Project Folder (Hybrid Provider)

If you're using Hybrid Provider but files aren't appearing in your project folder:

1. **Check Metro is running**: Hybrid Provider requires Metro to be running
2. **Check sync middleware is configured**: Make sure you passed `syncMiddleware` options to `configureMetroForMockifyer`
3. **Check Metro port**: Ensure Metro port matches (default: 8081)
4. **Check logs**: Look for `[HybridProvider]` messages in your app logs

Example with sync middleware:

```javascript
module.exports = configureMetroForMockifyer(config, {
  syncMiddleware: {
    projectRoot: __dirname,
    mockDataPath: './mock-data',
  },
});
```

