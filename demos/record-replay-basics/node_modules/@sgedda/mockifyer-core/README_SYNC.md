# Sync to Device CLI

The `sync-to-device` command syncs mock files from your project folder to React Native devices/simulators.

## Installation

The CLI is included in `@sgedda/mockifyer-core`:

```bash
npm install @sgedda/mockifyer-core
```

## Usage

### Command Line

```bash
# Auto-detect device (iOS on macOS, Android on Linux/Windows)
npx mockifyer-sync-to-device

# Or if installed locally
mockifyer-sync-to-device

# Explicit platform
mockifyer-sync-to-device --ios
mockifyer-sync-to-device --android

# Custom path
mockifyer-sync-to-device --path ./mocks

# Android with package name
mockifyer-sync-to-device --android --package com.myapp
```

### Programmatic Use

```typescript
import { syncToDevice, syncToIOSSimulator, syncToAndroid } from '@sgedda/mockifyer-core';

// Auto-detect and sync
await syncToDevice();

// Explicit platform
await syncToIOSSimulator('./mock-data');
await syncToAndroid('./mock-data', 'com.myapp');
```

### In package.json

```json
{
  "scripts": {
    "sync:to-device": "mockifyer-sync-to-device --path ./mock-data",
    "sync:to-device:ios": "mockifyer-sync-to-device --path ./mock-data --ios",
    "sync:to-device:android": "mockifyer-sync-to-device --path ./mock-data --android"
  }
}
```

## Options

- `-p, --path <path>` - Path to mock data directory (default: `./mock-data`)
- `--ios` - Try iOS Simulator first
- `--android` - Try Android Emulator first
- `--package <name>` - Android package name (auto-detected from `app.json` if available)
- `-h, --help` - Show help message

## Requirements

### iOS Simulator
- ✅ macOS
- ✅ Xcode installed
- ✅ Simulator booted and running
- ✅ App must have been run at least once

### Android Emulator
- ✅ Android SDK installed
- ✅ `adb` in PATH
- ✅ Emulator running
- ✅ App must have been run at least once

## Examples

```bash
# Basic usage
mockifyer-sync-to-device

# With custom path
mockifyer-sync-to-device --path ./my-mocks

# iOS only
mockifyer-sync-to-device --ios

# Android with package
mockifyer-sync-to-device --android --package com.example.app
```

## Workflow

1. **Edit mock files** in dashboard or project folder
2. **Sync to device**: `npm run sync:to-device`
3. **Restart app** to load synced files

## Related

- See `SYNC_TO_DEVICE.md` in example projects for detailed workflow
- See `AUTO_RELOAD.md` for automatic file watching (no restart needed!)



