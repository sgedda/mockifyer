# Hybrid Provider - Instant Mock File Sync

The **Hybrid Provider** automatically saves mock files to **both** the device filesystem and your project folder simultaneously. This eliminates the need for polling-based sync - files are immediately available in your project folder when saved.

## How It Works

When using the Hybrid Provider:

1. **Mock is saved** → Saved to device filesystem (via ExpoFileSystemProvider)
2. **Simultaneously** → Sent to Metro HTTP endpoint (`/mockifyer-save`)
3. **Metro saves** → File is immediately written to your project's `./mock-data/` folder
4. **Result** → File is available in both locations instantly (no polling delay!)

## Benefits

- ✅ **Instant sync** - No 5-second polling delay
- ✅ **Zero overhead** - No background polling process
- ✅ **Simpler architecture** - Direct HTTP communication
- ✅ **Reliable** - Files saved even if Metro endpoint temporarily unavailable (device save succeeds)

## Setup

The Hybrid Provider is automatically used when you call `setupMockifyerForReactNative` in development mode:

```typescript
import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch/react-native';

await setupMockifyerForReactNative({
  isDev: __DEV__,
  mockDataPath: 'mock-data',
  bundledDataPath: './assets/mock-data',
  recordMode: __DEV__ && true,
});
```

In development mode (`isDev: true`), this automatically uses the Hybrid Provider.

## Configuration

### Metro Port

By default, the Hybrid Provider connects to Metro on port `8081`. You can customize this:

```typescript
// Via environment variable
process.env.METRO_PORT = '8082';

// Or in your setup (if you need custom config)
await setupMockifyerForReactNative({
  isDev: __DEV__,
  mockDataPath: 'mock-data',
  config: {
    databaseProvider: {
      type: 'hybrid',
      path: 'mock-data',
      options: {
        metroPort: 8082, // Custom Metro port
      },
    },
  },
});
```

## Metro Middleware

The Metro middleware (`metro-sync-middleware.js`) must be configured in your `metro.config.js` to handle the `/mockifyer-save` endpoint:

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const mockSyncMiddleware = require('./metro-sync-middleware');

const config = getDefaultConfig(__dirname);

// Add middleware
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return mockSyncMiddleware.middleware(middleware);
  },
};

module.exports = config;
```

## How It Differs from Polling-Based Sync

### Old Approach (Polling)
- Metro polls simulator filesystem every 5 seconds
- Files appear in project folder with up to 5-second delay
- Background process consumes resources

### New Approach (Hybrid Provider)
- Files saved directly via HTTP POST
- Files appear in project folder instantly
- No background polling needed

## Fallback Behavior

If the Metro endpoint is unavailable (e.g., Metro not running), the Hybrid Provider:
1. ✅ Still saves to device filesystem (primary storage)
2. ⚠️ Logs a warning about project folder sync failure
3. ✅ Your app continues to work normally

You can manually sync later using the legacy sync endpoint (`/mockifyer-sync`) if needed.

## Troubleshooting

### Files not appearing in project folder

1. **Check Metro is running**: The Hybrid Provider requires Metro to be running
2. **Check Metro port**: Ensure `METRO_PORT` environment variable matches your Metro server port
3. **Check Metro middleware**: Verify `metro-sync-middleware.js` is configured in `metro.config.js`
4. **Check logs**: Look for `[HybridProvider]` messages in your app logs

### Metro endpoint errors

If you see errors like `Metro endpoint returned 404`, check:
- Metro middleware is properly configured
- `/mockifyer-save` endpoint is accessible
- Metro server is running on the expected port

### Device save succeeds but project folder sync fails

This is expected behavior if Metro is not running. The file is still saved to the device and your app will work normally. You can:
- Start Metro to enable project folder sync
- Use the legacy sync endpoint (`/mockifyer-sync`) to manually sync later




