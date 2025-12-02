# Metro Auto-Sync for Mock Files

This setup automatically syncs mock files from the iOS Simulator to your project folder during development, so you don't need to manually run sync commands.

## How It Works

The Metro middleware (`metro-sync-middleware.js`) automatically:

1. **Watches for new/modified files** in the simulator's mock-data directory
2. **Syncs every 5 seconds** (configurable) to your project's `./mock-data/` folder
3. **Only syncs changed files** (compares modification times)
4. **Provides HTTP endpoint** for manual sync: `http://localhost:8081/mockifyer-sync`

## Features

- ✅ **Automatic syncing** - Files sync automatically every 5 seconds
- ✅ **Smart syncing** - Only syncs new or modified files
- ✅ **Manual sync endpoint** - Can trigger sync via HTTP request
- ✅ **Non-blocking** - Doesn't interfere with Metro bundling
- ✅ **Development only** - Auto-sync only runs in development mode

## Usage

### Automatic Sync (Default)

When you start Metro with `npm start` or `npm run dev`, auto-sync is automatically enabled. You'll see:

```
[MockSync] Auto-sync enabled (every 5000ms)
[MockSync] Auto-synced 1 file(s): 2025-12-01_12-43-57_GET_jsonplaceholder_typicode_com_posts.json
```

### Manual Sync via REST API

You can trigger a sync manually using the REST API:

**Option 1: Using npm script**
```bash
npm run sync:mocks:api
```

**Option 2: Using curl**
```bash
curl http://localhost:8081/mockifyer-sync

# Response:
# {"success":true,"filesSynced":2,"syncedFiles":["file1.json","file2.json"],"timestamp":"2025-12-01T12:43:57.000Z"}
```

**Option 3: Check sync status**
```bash
npm run sync:mocks:status
# or
curl http://localhost:8081/mockifyer-sync/status

# Response:
# {"autoSyncEnabled":true,"syncInProgress":false,"lastSyncTime":1701432237000,"projectMockDataPath":"/path/to/mock-data"}
```

**Option 4: Call from React Native app**
```typescript
// In your React Native app
const metroUrl = 'http://localhost:8081'; // or your Metro server URL
const response = await fetch(`${metroUrl}/mockifyer-sync`);
const result = await response.json();
console.log('Synced files:', result.filesSynced);
```

### Disable Auto-Sync

To disable auto-sync, edit `metro.config.js` and comment out:

```javascript
// Start auto-sync in development (syncs every 5 seconds)
// if (process.env.NODE_ENV !== 'production') {
//   mockSyncMiddleware.startAutoSync(5000);
// }
```

### Change Sync Interval

To change the sync interval (default: 5000ms = 5 seconds), edit `metro.config.js`:

```javascript
mockSyncMiddleware.startAutoSync(10000); // Sync every 10 seconds
```

## How It Works Technically

1. **Metro Middleware**: Intercepts requests to `/mockifyer-sync` endpoint
2. **File Watcher**: Uses `fs.statSync` check modification times
3. **iOS Simulator Detection**: Uses `xcrun simctl` to find booted simulator
4. **File Copying**: Copies files from simulator directory to project folder

## Limitations

- **iOS Simulator only** (macOS) - Android emulator sync requires `adb` which is handled separately
- **Simulator must be booted** - Auto-sync only works when simulator is running
- **5 second delay** - Files sync with up to 5 second delay (configurable)

## Troubleshooting

### Auto-sync not working?

1. **Check Metro logs** - Look for `[MockSync]` messages
2. **Verify simulator is booted** - Run `xcrun simctl list devices booted`
3. **Check file permissions** - Ensure Metro can write to `./mock-data/`
4. **Restart Metro** - Sometimes Metro needs a restart after config changes

### Files not syncing?

1. **Check if files exist in simulator** - Look at the mock data path in console logs
2. **Verify auto-sync is enabled** - Check Metro startup logs
3. **Try manual sync** - `curl http://localhost:8081/mockifyer-sync`
4. **Check sync interval** - Files sync every 5 seconds, wait a bit

### Performance concerns?

If auto-sync is causing performance issues:

1. **Increase sync interval** - Change from 5000ms to 10000ms or more
2. **Disable auto-sync** - Use manual sync only
3. **Use manual sync script** - Run `npm run sync:mocks` when needed

## Integration with Dashboard

After files are synced to `./mock-data/`, you can use the Mockifyer dashboard:

```bash
npx @sgedda/mockifyer-dashboard --path ./mock-data
```

The dashboard will automatically pick up newly synced files!

