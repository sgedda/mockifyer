# Using Mockifyer with React Native and Expo

Mockifyer works with **Expo** and **React Native** via `@sgedda/mockifyer-fetch` (patches `global.fetch`) and `@sgedda/mockifyer-core` providers.

## Recommended: `setupMockifyerForReactNative`

Use **`setupMockifyerForReactNative`** from `@sgedda/mockifyer-fetch` (same entry as `setupMockifyer` path-wise; you can import from `@sgedda/mockifyer-fetch` or `@sgedda/mockifyer-fetch/react-native` depending on your bundler resolution).

| Mode | Provider | Behavior |
|------|----------|----------|
| **Development** (`isDev: true`) | **Hybrid** | Writes mocks to the **device** (Expo FileSystem) **and** to the **project** `mock-data` folder via Metro HTTP endpoints. |
| **Production** (`isDev: false`) | **Memory** | Loads mocks from a **bundled** module (e.g. `assets/mock-data.ts`). |

- **`MOCKIFYER_ENABLED=true`** or **`__DEV__`** enables Mockifyer in development (unless you override).
- **`METRO_PORT`** (optional) must match the Metro bundler port (default **8081**) so Hybrid can reach sync/save endpoints.
- After init in dev, **`reloadMockData(true)`** runs once to **pull** project `mock-data` onto the device (see sync below).

Example:

```typescript
import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch';

export async function initializeMockifyer() {
  const recordMode = __DEV__ && process.env.MOCKIFYER_RECORD === 'true';

  return setupMockifyerForReactNative({
    isDev: __DEV__,
    mockDataPath: 'mock-data',
    bundledDataPath: './assets/mock-data',
    recordMode,
    config: {
      logging: 'info',
    },
  });
}
```

In **`App`** / root layout, **`await initializeMockifyer()`** before other network-heavy setup so interception is active early.

---

## Metro sync middleware (required for Hybrid)

Hybrid saves to the repo through Metro. Add **`createMockSyncMiddleware`** from `@sgedda/mockifyer-fetch` (compiled **`dist/metro-sync-middleware.js`**) in **`metro.config.js`** — see **`example-projects/react-native-expo-example`** or **`example-projects/capp-react-native`** for patterns.

Typical responsibilities:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/mockifyer-save` | Device → project folder (JSON mock file) |
| `GET` | `/mockifyer-sync-to-device-manifest` | List mock files + mtimes for current scenario |
| `GET` | `/mockifyer-sync-to-device-file?path=…` | Single mock file (avoids huge all-in-one JSON) |
| `GET` | `/mockifyer-sync-to-device` | Legacy: all files in one response (large trees may fail) |
| `GET` | `/mockifyer-scenario-config` | Current scenario for the app |
| `POST` | `/mockifyer-clear` | Clear project mocks (optional) |

Middleware resolves **`projectRoot`** and **`mockDataPath`** (e.g. `./mock-data`). Scenario comes from **`mock-data/scenario-config.json`** or **`MOCKIFYER_SCENARIO`**.

**Build step:** if Metro `require`s `dist/metro-sync-middleware.js`, run **`npm run build`** in **`packages/mockifyer-fetch`** (and **`packages/mockifyer-core`**) so `dist/` exists, or use a project `metro.config.js` that builds those packages when missing.

**Project → device:** call **`instance.reloadMockData(true)`** (or rely on the initial sync inside `setupMockifyerForReactNative`). Uses manifest + per-file downloads over `http://localhost:${metroPort}` (simulator) — ensure Metro is running.

**Dashboard vs Metro:** **[`mockifyer-dashboard`](./packages/mockifyer-dashboard)** is a **separate** Express app (e.g. port **3002**) for browsing/editing mocks. Sync endpoints for the app run on **Metro**, not the dashboard, unless you mount the same middleware on Express yourself.

---

## Storage providers (manual / advanced)

You can use **`setupMockifyer`** with an explicit ` databaseProvider` instead of the helper:

1. **`hybrid`** — device + project (needs Metro middleware).
2. **`expo-filesystem`** — device only; mocks stay under the app **document directory** (no automatic sync to repo).
3. **`memory`** — in-memory; use for tests or production bundles with preloaded data.

```bash
npm install @sgedda/mockifyer-fetch
npx expo install expo-file-system
```

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  mockDataPath: 'mock-data',
  databaseProvider: {
    type: 'expo-filesystem',
    path: 'mock-data',
  },
  recordMode: true,
  useGlobalFetch: true,
});
```

---

## Where files live (Expo FileSystem / Hybrid device side)

On device, mocks are under the **document directory**, e.g.:

`FileSystem.documentDirectory` + `mock-data/<scenario>/...`

iOS Simulator example:

`…/Documents/mock-data/default/<host>/…/*.json`

The **project** copy (Hybrid + Metro) mirrors the same **relative paths** inside `mock-data/<scenario>/`.

Listing files in app code depends on your **expo-file-system** API (legacy `readDirectoryAsync` vs newer **`File`/`Directory`** APIs). The `ExpoFileSystemProvider` in core uses the modern API where available.

---

## Production: bundled mocks

1. Record / edit mocks in dev (Hybrid or filesystem).
2. Generate a static TS/JS module (e.g. `generateStaticDataFile` / build scripts in **`@sgedda/mockifyer-core`** `build-utils`).
3. Release build: `setupMockifyerForReactNative` with `isDev: false` loads **`bundledDataPath`** into **Memory** provider.

---

## Environment variables (React Native)

Typical:

```bash
MOCKIFYER_ENABLED=true
MOCKIFYER_RECORD=true    # recording mode when supported
MOCKIFYER_SCENARIO=default
METRO_PORT=8081          # if not default
```

Use **`app.config` / Babel** / **metro `transform-inline-environment-variables`** for vars that must appear in the JS bundle (see example projects).

---

## Optional: `mockifyer-dashboard`

Run **`npx mockifyer-dashboard`** (or the package binary) to open a local UI for the same **filesystem** `mock-data` tree. It does **not** replace Metro for in-app sync; it complements editing and scenario switching from the desktop.

---

## Summary

| Goal | Approach |
|------|----------|
| Best Expo dev UX | **`setupMockifyerForReactNative`** + **Metro `createMockSyncMiddleware`** + `MOCKIFYER_ENABLED` / `MOCKIFYER_RECORD` as needed |
| Device-only, no repo sync | **`expo-filesystem`** provider |
| Production / store build | **Memory** + **bundled** mock module |
| Edit mocks visually | **mockifyer-dashboard** (optional; separate server) |

For **`recordMode`**, **`similarMatch`**, **GraphQL** matching, and **fail-on-missing-mock**, use the same `MockifyerConfig` options as in **`@sgedda/mockifyer-fetch`** README / types.
