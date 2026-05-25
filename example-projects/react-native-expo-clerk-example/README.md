# React Native Expo · local demo login + Mockifyer

> **Note:** Folder is still named `react-native-expo-clerk-example` for stable docs links; auth is **Clerk-free** — a single **on-device demo user** (`SecureStore` / `localStorage`), no dashboards or OAuth apps.

Companion to [`react-native-expo-example`](../react-native-expo-example): after **Continue as demo user**, the dashboard runs **several public HTTP APIs** so Mockifyer sees distinct hosts, query strings, headers, and a POST body.

## Zero external auth tooling

1. **`npm install`**
2. **`npm run dev`** (or `npm run start`)

No Clerk key, no Google/GitHub OAuth project, no `.env` for sign-in.

Session is persisted only on this device/emulator/browser tab for convenience; it is **not** a verified identity.

## Optional: bundled mocks for release

```bash
npm run generate:build-data
```

## Mockifyer env (optional)

Same `EXPO_PUBLIC_MOCKIFYER_*` / `MOCKIFYER_*` patterns as the main RN example — see [REACT_NATIVE.md](../../REACT_NATIVE.md). No `.env` is required to try the dashboard with **replay mocks** if your `mock-data/` is populated.

Use `expo start -c` after changing bundled env-driven variables so Metro picks up new values.

### Local package development (source vs dist)

With **`file:../../packages/...`** deps, Metro normally bundles compiled output from **`dist/`**. Two ways to iterate on Mockifyer packages:

| Approach | Command | When to use |
|----------|---------|-------------|
| **Source mode (hybrid)** | `npm run dev:source` | Edit `packages/*/src` — Metro bundles `.ts` directly (requires local `file:` links) |
| **Source mode (redis)** | `npm run dev:source:redis` | Same, with Redis proxy backend — run `npm run redis:up` + `npm run dashboard:redis` first |
| **Dist + watch** | `npm run watch` in each package + `npm run dev` | Classic `tsc --watch` workflow |

Source mode sets `MOCKIFYER_USE_SOURCE=true` (see `metro.config.js`). Metro bundles `packages/*/src` into the app; **`dist/metro-config.js` is still used once** for the Node-side Metro helper (run `npm --prefix ../../packages/mockifyer-fetch run build` if that file is missing). Recording: `npm run dev:source:record` (hybrid) or `npm run dev:source:redis:record` (redis).

Requires `npm run switch:local` (default in this repo). Clear Metro cache after toggling: `expo start -c`.

### Local Redis (Docker)

For **`npm run dashboard:redis`** and **`npm run dev:redis*`** / **`dev:source:redis*`**:

```bash
npm run redis:up
npm run dashboard:redis   # installs dashboard deps (incl. ioredis) automatically
```

```bash
npm run redis:down
```

## What it demonstrates

| Area | Detail |
|------|--------|
| Auth | Local **demo user** persisted with `expo-secure-store` (native) or `localStorage` (web demo) |
| Mockifyer order | `initializeMockifyer()` before the auth gate |
| APIs after login | Auto-loaded on dashboard: PokéAPI, Rick & Morty, Dog CEO, Cat Facts, REST Countries, RandomUser, Open-Meteo, Nationalize.io, GitHub REST, ReqRes **POST** |

## Notes

- **GitHub REST** demo may rate-limit anonymous API calls — unrelated to “login”; it’s sample traffic for Mockifyer.
- Assets are placeholders — replace before store submissions.
