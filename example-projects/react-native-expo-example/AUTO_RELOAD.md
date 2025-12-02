# Automatic File Reload (Native App Solution)

Mockifyer now supports **automatic file reloading** directly in the native app, without requiring Metro endpoints or external dependencies!

## How It Works

The `ExpoFileSystemProvider` includes built-in file watching that:
- ✅ **Polls for file changes** every 2 seconds (configurable)
- ✅ **Automatically clears cache** when files change
- ✅ **Works purely in the app** - no Metro dependencies
- ✅ **Zero configuration** - enabled by default in development

## Features

### 1. Automatic File Watching (Default)

Files are automatically watched for changes. When you sync new files to the device, they're automatically picked up on the next API request.

**No configuration needed!** Just:
1. Edit files in dashboard or project folder
2. Sync: `npm run sync:to-device`
3. Make API request - **new files are automatically used!**

### 2. Manual Reload

You can also manually trigger a reload:

```typescript
// In your app
if (mockifyerInstance) {
  mockifyerInstance.reloadMockData();
}
```

### 3. Custom Configuration

Configure watch behavior in your setup:

```typescript
import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch';

const instance = await setupMockifyerForReactNative({
  isDev: __DEV__,
  mockDataPath: 'mock-data',
  recordMode: true,
  config: {
    databaseProvider: {
      type: 'hybrid',
      path: 'mock-data',
      options: {
        watchFiles: true,        // Enable watching (default: true)
        watchInterval: 2000,     // Check every 2 seconds (default: 2000ms)
        onFilesChanged: () => {  // Optional callback
          console.log('Files changed!');
        },
      },
    },
  },
});
```

## Benefits

- ✅ **No Metro dependency** - Works in any React Native environment
- ✅ **Automatic** - Files are watched without any code changes
- ✅ **Efficient** - Only checks modification times, not file contents
- ✅ **Configurable** - Adjust polling interval or disable if needed
- ✅ **Simple** - Just sync files and use them!

## Workflow

1. **Edit mock file** (dashboard or project folder)
2. **Sync to device**: `npm run sync:to-device`
3. **Make API request** - New file is automatically used!

No restart, no manual reload needed! 🎉

## Disabling File Watching

If you want to disable automatic watching:

```typescript
config: {
  databaseProvider: {
    type: 'hybrid',
    options: {
      watchFiles: false, // Disable automatic watching
    },
  },
}
```

## How It Works Internally

1. **File Cache**: Provider caches file modification times
2. **Polling**: Checks every 2 seconds (configurable) for changes
3. **Change Detection**: Compares file count and modification times
4. **Cache Clear**: When changes detected, clears cache
5. **Fresh Read**: Next request reads files fresh from disk

This ensures files are always up-to-date without manual intervention!



