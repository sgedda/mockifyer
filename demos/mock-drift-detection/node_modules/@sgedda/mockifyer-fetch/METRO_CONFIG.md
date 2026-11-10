# Metro Configuration for React Native

Mockifyer requires Metro bundler configuration to stub Node.js built-in modules that aren't available in React Native.

## Quick Setup

Use the provided helper function to configure Metro automatically:

```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');

const config = getDefaultConfig(__dirname);
module.exports = configureMetroForMockifyer(config);
```

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

Mockifyer packages use Node.js built-in modules (`fs`, `path`) for filesystem operations. These modules aren't available in React Native, so Metro needs to stub them during bundling. The stubs are empty modules that allow bundling to succeed while the code gracefully handles their absence at runtime.

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

