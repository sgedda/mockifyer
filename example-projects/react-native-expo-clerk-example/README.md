# React Native Expo + Clerk + Mockifyer

Example app alongside [`react-native-expo-example`](../react-native-expo-example): **Clerk** email/password auth (login → dashboard) and **several public HTTP APIs** so Mockifyer sees distinct hosts, query strings, headers, and a POST body.

## Setup

1. From this folder:

   ```bash
   npm install
   ```

2. **Clerk**: create an application in the [Clerk Dashboard](https://dashboard.clerk.com/), enable **Email + password**, and copy the **publishable** key.

3. Env (Expo inlines `EXPO_PUBLIC_*` at bundle time):

   ```bash
   cp .env.example .env
   # set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   ```

4. Bundled mocks for release builds:

   ```bash
   npm run generate:build-data
   ```

5. Start (same Mockifyer scripts as the other RN example):

   ```bash
   npm run dev
   # or record:
   npm run dev:hybrid:record
   ```

   Use `expo start -c` after changing `.env` so Metro picks up new env vars.

### Local Redis (Docker)

For **`npm run dashboard:redis`** and **`npm run dev:redis*`**, start Redis on **`127.0.0.1:6379`**:

```bash
npm run redis:up
```

Stop when finished:

```bash
npm run redis:down
```

## What it demonstrates

| Area | Detail |
|------|--------|
| Auth | `ClerkProvider`, `tokenCache`, email/password via `signIn.password`, `SignedIn` / `SignedOut` |
| Mockifyer order | `initializeMockifyer()` runs **before** `ClerkProvider` so Clerk’s HTTP traffic can be intercepted too |
| APIs after login | RandomUser, Open-Meteo (query params), Nationalize.io, GitHub REST (`Accept` header), ReqRes **POST** JSON |

## Notes

- **GitHub** may rate-limit anonymous API calls.
- Icon/splash assets here are tiny placeholders; replace with real artwork before store builds.
- For Mockifyer dashboard, Redis/hybrid usage, and sync commands, see the main example’s README and [REACT_NATIVE.md](../../REACT_NATIVE.md).
