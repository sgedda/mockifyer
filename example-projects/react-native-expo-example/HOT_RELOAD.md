# Hot Reload for Mock Files

Mockifyer supports hot reloading of mock files without restarting your app!

## How It Works

The **ExpoFileSystemProvider** reads mock files **on-demand** (no cache), which means:
- ✅ Files are always fresh - changes are picked up automatically
- ✅ No restart needed - just edit files and make new requests
- ✅ Works seamlessly with dashboard edits

## Usage

### Option 1: Automatic (Default) ✅

**Files are read on every request**, so changes are automatically picked up:

1. Edit mock file in dashboard or project folder
2. Sync to device: `npm run sync:to-device`
3. Make API request in app - **new file is automatically used**

No restart needed! 🎉

### Option 2: Manual Reload Button

Tap the **"🔄 Reload Mocks"** button in the app to:
- Signal Metro that files may have changed
- Get confirmation that reload was triggered
- Useful for debugging or explicit refresh

### Option 3: Programmatic Reload

```typescript
// In your app code
const metroPort = process.env.METRO_PORT || '8081';
await fetch(`http://localhost:${metroPort}/mockifyer-reload`, {
  method: 'POST',
});
```

## Workflow Examples

### Editing in Dashboard

1. **Start dashboard:**
   ```bash
   npm run dashboard
   ```

2. **Edit mock file** at http://localhost:3001

3. **Sync to device:**
   ```bash
   npm run sync:to-device
   ```

4. **Make API request** - new mock is automatically used!

### Editing in Project Folder

1. **Edit file** in `./mock-data/`

2. **Sync to device:**
   ```bash
   npm run sync:to-device
   ```

3. **Make API request** - updated mock is automatically used!

## Why No Restart Needed?

Mockifyer's `ExpoFileSystemProvider`:
- Reads files directly from filesystem on each request
- No caching - always gets the latest version
- Matches requests against current files in real-time

This means **changes are immediately available** without any restart!

## Tips

- **Fast iteration**: Edit → Sync → Test (no restart!)
- **Dashboard workflow**: Edit → Sync → Test → Repeat
- **Team collaboration**: Share mock files via git, sync to device, test immediately

## Troubleshooting

### Changes not appearing?

1. **Check file was synced:**
   ```bash
   npm run sync:to-device
   ```

2. **Verify file location:**
   - iOS: `Documents/mock-data/`
   - Android: `/data/data/{package}/files/mock-data/`

3. **Check file format:**
   - Must be valid JSON
   - Must match expected `MockData` structure

4. **Make a new request:**
   - Files are read on-demand
   - Old requests won't change, but new ones will use updated files

### Still not working?

- Restart app as fallback (though usually not needed)
- Check Metro logs for file read errors
- Verify file permissions on device



