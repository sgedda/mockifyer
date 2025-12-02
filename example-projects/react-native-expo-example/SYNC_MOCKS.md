# Syncing Mock Files from Device to Project Folder

When using `expo-filesystem` provider in development, mock files are saved to the device's/simulator's file system. This guide explains how to sync those files back to your project's `mock-data` folder so they can be version controlled and viewed in the dashboard.

## Quick Start

```bash
# Sync mocks from device/simulator to project folder
npm run sync:mocks

# For iOS Simulator specifically
npm run sync:mocks:ios

# For Android Emulator specifically
npm run sync:mocks:android
```

## How It Works

The sync script automatically detects and copies mock files from:

1. **iOS Simulator** (macOS only): Reads files from the simulator's app data directory
2. **Android Emulator**: Uses `adb pull` to copy files from the device
3. **HTTP Endpoint** (future): Can fetch files via HTTP if your app exposes a sync endpoint

## Prerequisites

- Your React Native app must be running in development mode (`__DEV__ === true`)
- Mock files must have been created (via `recordMode: true` or manual saves)
- For iOS: Simulator must be booted
- For Android: Emulator must be running and `adb` must be connected

## Usage

### Basic Sync

```bash
npm run sync:mocks
```

This will:
1. Try to detect which platform you're using (iOS/Android)
2. Find mock files in the device/simulator
3. Copy them to `./mock-data/` in your project
4. Show a summary of synced files

### Platform-Specific Sync

```bash
# Force iOS Simulator sync
npm run sync:mocks:ios

# Force Android Emulator sync
npm run sync:mocks:android
```

### Troubleshooting

If sync fails, check:

1. **Is your app running?**
   - Make sure Metro bundler is running
   - App should be loaded in simulator/emulator

2. **Are there any mock files?**
   - Check if `recordMode: true` is set
   - Verify files exist in the device's document directory

3. **iOS Simulator:**
   - Ensure simulator is booted: `xcrun simctl list devices booted`
   - Check console logs for mock data directory path

4. **Android Emulator:**
   - Ensure `adb` is working: `adb devices`
   - Check that emulator is listed

## Integration with Dashboard

After syncing, you can use the Mockifyer dashboard to view and edit your mocks:

```bash
# From project root
npx @sgedda/mockifyer-dashboard --path ./mock-data
```

The dashboard will show all synced mock files and allow you to:
- View mock requests and responses
- Edit response data
- See request flow visualization

## Workflow

Recommended development workflow:

1. **Start your app in record mode:**
   ```bash
   npm run dev:record
   ```

2. **Make API calls** in your app (they'll be saved to device)

3. **Sync files to project:**
   ```bash
   npm run sync:mocks
   ```

4. **View/edit in dashboard:**
   ```bash
   npx @sgedda/mockifyer-dashboard --path ./mock-data
   ```

5. **Commit to version control:**
   ```bash
   git add mock-data/
   git commit -m "Add recorded mocks"
   ```

## File Locations

### iOS Simulator
Files are stored at:
```
~/Library/Developer/CoreSimulator/Devices/[DEVICE_ID]/data/Containers/Data/Application/[APP_ID]/Documents/mock-data/
```

### Android Emulator
Files are stored at:
```
/data/data/[PACKAGE_NAME]/files/mock-data/
```

### Project Folder
Synced files are copied to:
```
./mock-data/
```

## Notes

- The sync script only copies `.json` files
- Existing files in `./mock-data/` are overwritten if they have the same name
- The sync script does not delete files - it only adds/updates
- For production builds, use the bundled TypeScript file (generated via `npm run generate:build-data`)




