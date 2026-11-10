# Sync from Device CLI

The `sync-from-device` command syncs mock files from React Native devices/simulators back to your project folder.

## Installation

The CLI is included in `@sgedda/mockifyer-core`:

```bash
npm install @sgedda/mockifyer-core
```

## Usage

### Command Line

```bash
# Auto-detect device (iOS on macOS, Android on Linux/Windows)
npx mockifyer-sync-from-device

# Or if installed locally
mockifyer-sync-from-device

# Explicit platform
mockifyer-sync-from-device --ios
mockifyer-sync-from-device --android

# HTTP endpoint (if app exposes /mocks endpoint)
mockifyer-sync-from-device --http

# Custom path
mockifyer-sync-from-device --path ./mocks

# Android with package name
mockifyer-sync-from-device --android --package com.myapp
```

### Programmatic Use

```typescript
import { syncFromDevice, syncFromIOSSimulator, syncFromAndroid, syncFromHTTP } from '@sgedda/mockifyer-core';

// Auto-detect and sync
await syncFromDevice();

// Explicit platform
await syncFromIOSSimulator('./mock-data');
await syncFromAndroid('./mock-data', 'com.myapp');
await syncFromHTTP('./mock-data', 8080);
```

### In package.json

```json
{
  "scripts": {
    "sync:mocks": "mockifyer-sync-from-device --path ./mock-data",
    "sync:mocks:ios": "mockifyer-sync-from-device --path ./mock-data --ios",
    "sync:mocks:android": "mockifyer-sync-from-device --path ./mock-data --android"
  }
}
```

## Options

- `-p, --path <path>` - Path to mock data directory (default: `./mock-data`)
- `--ios` - Try iOS Simulator first
- `--android` - Try Android Emulator first
- `--http` - Try HTTP endpoint (requires app to expose `/mocks` endpoint)
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

### HTTP Endpoint
- ✅ App must expose a `/mocks` endpoint that returns an array of mock objects
- ✅ Each mock object should have `filename` and `content` properties

## Examples

```bash
# Basic usage
mockifyer-sync-from-device

# With custom path
mockifyer-sync-from-device --path ./my-mocks

# iOS only
mockifyer-sync-from-device --ios

# Android with package
mockifyer-sync-from-device --android --package com.example.app

# HTTP endpoint
mockifyer-sync-from-device --http
```

## Workflow

1. **Record mocks** in your app (they're saved to device filesystem)
2. **Sync from device**: `npm run sync:mocks`
3. **View/edit** in dashboard or version control

## Related

- See `README_SYNC.md` for syncing TO device (project → device)
- See example projects for complete workflow



