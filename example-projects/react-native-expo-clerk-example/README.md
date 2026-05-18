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

### Local Redis (Docker)

For **`npm run dashboard:redis`** and **`npm run dev:redis*`**:

```bash
npm run redis:up
```

```bash
npm run redis:down
```

## What it demonstrates

| Area | Detail |
|------|--------|
| Auth | Local **demo user** persisted with `expo-secure-store` (native) or `localStorage` (web demo) |
| Mockifyer order | `initializeMockifyer()` before the auth gate |
| APIs after login | RandomUser, Open-Meteo (query params), Nationalize.io, GitHub REST (`Accept` header), ReqRes **POST** JSON |

## Notes

- **GitHub REST** demo may rate-limit anonymous API calls — unrelated to “login”; it’s sample traffic for Mockifyer.
- Assets are placeholders — replace before store submissions.
