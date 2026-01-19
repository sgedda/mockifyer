# React Native Expo Example with Mockifyer

This example demonstrates how to use Mockifyer in a React Native Expo application with TypeScript bundle generation.

## Features

- ✅ **Development Mode**: Uses Hybrid Provider (saves to device + project folder simultaneously)
- ✅ **Production Mode**: Uses Memory provider with bundled TypeScript file
- ✅ **Automatic Bundle Generation**: CLI tool or build script generates TypeScript file from recorded mocks
- ✅ **Instant Mock File Sync**: Files saved directly to project folder (no polling delay!)
- ✅ **TypeScript Support**: Full TypeScript support throughout
- ✅ **Conditional Setup**: Automatically switches between Hybrid and Memory providers
- ✅ **Simplified Setup**: Two approaches available - simple helper function or full control

## Prerequisites

- Node.js 18+ and npm
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for macOS) or Android Emulator

## Setup

### 1. Install Dependencies

```bash
cd example-projects/react-native-expo-example
npm install
```

### 2. Build Mockifyer Packages

Make sure the Mockifyer packages are built:

```bash
# From the monorepo root
cd ../../packages/mockifyer-core && npm run build
cd ../mockifyer-fetch && npm run build
```

### 3. Install Dependencies

Make sure dependencies are installed (this creates symlinks to local packages):

```bash
npm install
```

### 4. Metro Configuration

The project includes a `metro.config.js` that:
- ✅ Configures Metro bundler to resolve the local monorepo packages
- ✅ Stubs Node.js built-in modules (`fs`, `path`, `assert`, `util`) for React Native bundling
- ✅ Sets up sync middleware for Hybrid Provider (saves files to project folder)

The config uses `configureMetroForMockifyer` which automatically handles both FS stubbing and sync middleware setup:

```javascript
config = configureMetroForMockifyer(config, {
  syncMiddleware: {
    projectRoot: __dirname,
    mockDataPath: './mock-data',
  },
});
```

This is required for Metro to find `@sgedda/mockifyer-core` and `@sgedda/mockifyer-fetch`, and enables Hybrid Provider to save files to your project folder.

### 5. Setup Mockifyer

The project uses the simplified setup (`mockifyer-setup-simple.ts`) which automatically handles dev/prod provider selection. The setup is already configured in `App.tsx`.

## Usage

### Development Mode (Recording Mocks)

1. **Start the app with recording enabled**:

```bash
npm run dev:record
```

2. **Make API calls** in the app by tapping "Fetch Posts" or "Fetch User"
3. **Mocks are automatically saved** to both device filesystem AND project folder (via Hybrid Provider)
   - Files appear instantly in `./mock-data/` - no manual sync needed!
   - See [HYBRID_PROVIDER.md](./HYBRID_PROVIDER.md) for details
   
   For manual sync (if using ExpoFileSystem Provider):
   ```bash
   npm run sync:mocks
   ```
   See [SYNC_MOCKS.md](./SYNC_MOCKS.md) for detailed sync instructions.

### Generating Bundle for Production

1. **Ensure you have recorded mock data** in the `mock-data/` directory
2. **Generate the TypeScript bundle** using the CLI tool:

```bash
npm run generate:build-data
```

Or use the CLI directly:

```bash
npx @sgedda/mockifyer-core generate-bundle --input ./mock-data --output ./assets/mock-data.ts
```

This creates `assets/mock-data.ts` with all your recorded mocks.

**CLI Options:**
- `--input, -i`: Path to mock data directory (default: `./mock-data`)
- `--output, -o`: Output file path (default: `./assets/mock-data.ts`)
- `--format, -f`: Output format: `json`, `typescript`, `javascript` (default: `typescript`)
- `--variable-name, -v`: Variable name for exported data (default: `mockData`)

3. **Build your app**:

```bash
# For iOS
npm run build:ios

# For Android
npm run build:android
```

The bundled TypeScript file will be included in your production build.

### Running the App

```bash
# Development mode (uses FileSystem provider)
npm run dev

# Development mode with recording enabled
npm run dev:record

# Standard Expo start
npm start
```

## Project Structure

```
react-native-expo-example/
├── App.tsx                      # Main app component with API calls (uses simplified setup)
├── mockifyer-setup-simple.ts    # Simplified setup (uses helper function) ✅ ACTIVE
├── mockifyer-setup.ts           # Full control setup (reference/alternative)
├── scripts/
│   ├── generate-build-data.ts   # Custom build script (optional)
│   ├── sync-mocks.ts            # Sync mocks from device to project folder
│   └── dev-mock-sync-server.ts  # Dev helper for mock sync (optional)
├── mock-data/                   # Recorded mock files (development, synced from device)
├── assets/
│   └── mock-data.ts             # Generated bundle (production)
├── package.json
├── tsconfig.json
├── README.md
└── SYNC_MOCKS.md                # Guide for syncing mock files
```

**Note:** The project uses `mockifyer-setup-simple.ts` by default. See `mockifyer-setup.ts` for a full-control alternative.

## Setup Approach

This project uses the **Simplified Setup** (✅ Active):

```typescript
// mockifyer-setup-simple.ts (used by App.tsx)
import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch';

export async function initializeMockifyer() {
  return await setupMockifyerForReactNative({
    isDev: __DEV__, // Pass React Native's __DEV__ variable
    mockDataPath: 'mock-data',
    bundledDataPath: './assets/mock-data',
    recordMode: process.env.MOCKIFYER_RECORD === 'true',
  });
}
```

**Note:** The `isDev` parameter is required and should be passed from your application code. This keeps the package framework-agnostic and gives you full control over dev/prod detection.

**Benefits:**
- ✅ Minimal code (~10 lines)
- ✅ Automatic dev/prod detection
- ✅ Handles all provider switching logic
- ✅ Still flexible via config options

**Alternative:** See `mockifyer-setup.ts` for a full-control setup with complete manual provider selection (useful for advanced customization).

## How It Works

### Development Mode (`__DEV__ === true`)

- Uses **Expo FileSystem Provider**
- Can record new API responses
- Files stored on device filesystem
- Accessible via Metro bundler

### Production Mode (`__DEV__ === false`)

- Uses **Memory Provider**
- Loads data from bundled `assets/mock-data.ts`
- No filesystem dependency
- Faster in-memory access
- No recording capability

### Bundle Generation

The `generate-build-data.ts` script:

1. Reads all JSON files from `mock-data/`
2. Transforms them to clean `MockData` format
3. Generates a TypeScript file with `export const mockData = [...] as const;`
4. Metro bundles this file during build
5. App dynamically imports it at runtime (production only)

## Example API Calls

The app demonstrates fetching:

- **Posts**: `GET https://jsonplaceholder.typicode.com/posts`
- **User**: `GET https://jsonplaceholder.typicode.com/users/1`

## Environment Variables

- `MOCKIFYER_ENABLED=true` - Enable Mockifyer (default: enabled in `__DEV__`)
- `MOCKIFYER_RECORD=true` - Enable recording mode (development only)

## Troubleshooting

### "No bundled mock data found"

Make sure you've run `npm run generate:build-data` before building for production.

### "Mock data directory not found"

Ensure you have recorded some mocks during development and they're in the `mock-data/` directory.

### TypeScript errors

Make sure all Mockifyer packages are built:
```bash
cd ../../packages/mockifyer-core && npm run build
cd ../mockifyer-fetch && npm run build
```

## Next Steps

1. Record mocks during development
2. Generate bundle before production builds
3. Customize the filter/transform logic in `generate-build-data.ts`
4. Add more API endpoints to test
5. Implement automatic file extraction from device

## Related Documentation

- [Hybrid Provider](./HYBRID_PROVIDER.md) - Instant mock file sync (recommended)
- [Metro Auto-Sync](./METRO_AUTO_SYNC.md) - Polling-based sync (for ExpoFileSystem Provider)
- [Sync Mocks](./SYNC_MOCKS.md) - Manual sync scripts
- [React Native Guide](../../REACT_NATIVE.md)
- [Build Workflow](../../packages/mockifyer-core/REACT_NATIVE_BUILD_WORKFLOW.md)
- [Mockifyer Core Examples](../../packages/mockifyer-core/examples/)

