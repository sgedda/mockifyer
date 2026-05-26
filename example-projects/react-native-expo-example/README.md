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

1. **Start the app with recording enabled** (hybrid — no Redis):

```bash
npm run dev:record
```

For **Redis / dashboard proxy** recording, start the dashboard (`npm run dashboard:redis`) in another terminal, then run `npm run dev:redis:record`.

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

### Running the App (`package.json` scripts)

Expo inlines **`EXPO_PUBLIC_*`** variables when Metro bundles the app. The example reads them in `mockifyer-setup-simple.ts` (see that file for the full matrix). **`MOCKIFYER_*`** vars are still supported where noted (e.g. Metro / Node tooling).

| Script | Backend | Notes |
|--------|---------|--------|
| `npm run dev` | Hybrid | Mockifyer on; local/mock-data via Metro (no Redis). |
| `npm run dev:hybrid` | Hybrid | Same as `dev`, explicit backend. |
| `npm run dev:hybrid:record` | Hybrid | Recording on. |
| `npm run dev:hybrid:record:tests` | Hybrid | Recording + generated Jest tests. |
| `npm run dev:redis` | Redis proxy | Start **`npm run dashboard:redis`** first (or set `EXPO_PUBLIC_MOCKIFYER_PROXY_URL` if not on default host/port). |
| `npm run dev:redis:record` | Redis proxy | Recording on. |
| `npm run dev:redis:record:tests` | Redis proxy | Recording + test generation. |
| `npm run dev:redis:record:no-proxy-miss` | Redis proxy | Recording on, but **`EXPO_PUBLIC_MOCKIFYER_PROXY_RECORD_ON_MISS=false`** (see setup file). |
| `npm run dev:off` | Hybrid | `MOCKIFYER_MODE=off` — disable intercept. |
| `npm run dev:launch-client` | Hybrid | `MOCKIFYER_MODE=launch_client` — useful for E2E / Maestro-style flows. |
| `npm run dev:record` | Hybrid | Shortcut alias for `dev:hybrid:record`. |
| `npm run dev:record:tests` | Hybrid | Shortcut alias for `dev:hybrid:record:tests`. |
| `npm start` | — | Plain Expo; use `dev:*` when you want env-driven Mockifyer. |

**Optional env (bundle-time):**

- `EXPO_PUBLIC_MOCKIFYER_PROXY_URL` — Dashboard origin (default: `http://localhost:3002` on iOS simulator, `http://10.0.2.2:3002` on Android emulator).
- `EXPO_PUBLIC_MOCKIFYER_BACKEND` — `hybrid` (default) or `redis` / `proxy` / `dashboard` for Redis-backed proxy mode.

**Windows:** inline `VAR=value` in npm scripts is Unix-oriented. Use a tool like `cross-env` or set the same variables in your shell before `expo start`.

### Dashboard with Redis Provider

Use the dashboard in Redis mode when your mock data is stored in Redis:

```bash
# Uses redis://localhost:6379
npm run dashboard:redis

# Uses MOCKIFYER_REDIS_URL from env
MOCKIFYER_REDIS_URL=redis://localhost:6380 npm run dashboard:redis:custom
```

See `DASHBOARD.md` for the full Redis dashboard flow and options.

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

This project uses the **Simplified Setup** (✅ Active) in `mockifyer-setup-simple.ts` (imported from `App.tsx`):

- **Hybrid (default):** `setupMockifyerForReactNative` — Metro + device mock-data, no Redis.
- **Redis / dashboard proxy:** `initMockifyerForReactNativeDashboard` when `EXPO_PUBLIC_MOCKIFYER_BACKEND` is `redis` (or `proxy` / `dashboard`). Run `npm run dashboard:redis` on the host first.

Recording, runtime mode, test generation, and proxy URL are driven by **`EXPO_PUBLIC_*`** and **`MOCKIFYER_*`** env vars (see table above and the top-of-file comment in `mockifyer-setup-simple.ts`).

**Alternative:** See `mockifyer-setup.ts` for a full-control setup with manual provider selection.

## How It Works

### Development Mode (`__DEV__ === true`)

- **Hybrid:** Hybrid / filesystem flow via `setupMockifyerForReactNative` (mock-data on device + project; see [Hybrid Provider](./HYBRID_PROVIDER.md)).
- **Redis mode:** Requests go through the dashboard proxy; run `dashboard:redis` and use `npm run dev:redis`.
- Can record new API responses when recording env flags are set.

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

- `MOCKIFYER_MODE` / `EXPO_PUBLIC_MOCKIFYER_MODE` — `on` | `off` | `launch_client` (aliases: `e2e`, `maestro`, etc. — see `mockifyer-setup-simple.ts`).
- `MOCKIFYER_RECORD` / `EXPO_PUBLIC_MOCKIFYER_RECORD` — `true` enables recording in development.
- `MOCKIFYER_GENERATE_TESTS` / `EXPO_PUBLIC_MOCKIFYER_GENERATE_TESTS` — `true` enables test generation in dev config.
- `EXPO_PUBLIC_MOCKIFYER_BACKEND` — `hybrid` or `redis` (or `proxy` / `dashboard` as aliases for Redis mode).
- `EXPO_PUBLIC_MOCKIFYER_PROXY_URL` — Dashboard base URL for Redis/proxy mode.
- `EXPO_PUBLIC_MOCKIFYER_PROXY_RECORD_ON_MISS` — `true` | `false` to override proxy “record on miss” independently of `recordMode`.

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

