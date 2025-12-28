# Sync Mock Files to Device

Sync mock files from your project folder (`./mock-data/`) back to your React Native device/simulator.

## Quick Start

```bash
# Auto-detect device (iOS on macOS, Android on Linux/Windows)
npm run sync:to-device

# Explicit platform
npm run sync:to-device:ios
npm run sync:to-device:android
```

## How It Works

The sync command is provided by `@sgedda/mockifyer-core` package. It:

1. **Reads mock files** from `./mock-data/` directory
2. **Detects your device** (iOS Simulator or Android Emulator)
3. **Copies files** to the device's app data directory
4. **Reports results** with file count and status

## Requirements

### iOS Simulator
- ✅ macOS
- ✅ Xcode installed
- ✅ Simulator booted and running
- ✅ App must have been run at least once (to create app data directory)

### Android Emulator
- ✅ Android SDK installed
- ✅ `adb` in PATH
- ✅ Emulator running
- ✅ App must have been run at least once

## Usage Examples

```bash
# Basic sync (auto-detect)
npm run sync:to-device

# iOS only
npm run sync:to-device:ios

# Android only
npm run sync:to-device:android

# Custom path (if using different directory)
node ../../packages/mockifyer-core/dist/cli/sync-to-device.js --path ./my-mocks

# Android with explicit package name
node ../../packages/mockifyer-core/dist/cli/sync-to-device.js --android --package com.myapp
```

## Programmatic Use

You can also use it programmatically in your scripts:

```typescript
import { syncToDevice, syncToIOSSimulator, syncToAndroid } from '@sgedda/mockifyer-core';

// Auto-detect
await syncToDevice();

// Explicit platform
await syncToIOSSimulator('./mock-data');
await syncToAndroid('./mock-data', 'com.myapp');
```

## Workflow

1. **Edit mock files** in dashboard or manually edit JSON files in `./mock-data/`
2. **Sync to device**: `npm run sync:to-device`
3. **Restart app** to load synced files (or use reload button if implemented)

## Troubleshooting

### "No booted simulator found"
- Make sure your iOS Simulator is running
- Run your app at least once to create the app data directory

### "adb not found"
- Install Android SDK
- Add `adb` to your PATH

### "Source directory not found"
- Make sure `./mock-data/` exists
- Or specify custom path with `--path`

### "No files were synced"
- Check that you have `.json` files in the mock-data directory
- Verify file permissions

## Related

- See `HOT_RELOAD.md` for automatic file watching (no restart needed!)
- See `DASHBOARD.md` for viewing and editing mock files
