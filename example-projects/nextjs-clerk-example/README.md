# Next.js + OAuth (Google / GitHub) + Mockifyer

> **Note:** Directory name `example-projects/nextjs-clerk-example/` is unchanged for stable paths in docs; authentication here is **Auth.js** OAuth (Google / GitHub), not Clerk.

Full-stack example: **[Auth.js (`next-auth` v5)](https://authjs.dev)** with optional **Google** and **GitHub** OAuth plus a **built-in demo user** when OAuth is not configured. The App Router **dashboard** triggers **Route Handlers** that each call a public API with server-side `fetch`. [Mockifyer](https://github.com/sgedda/mockifyer) runs in the **Node** process via root [`instrumentation.ts`](https://nextjs.org/docs/app/guides/instrumentation), so `fetch` in `app/api/**` is recorded or replayed from disk (or via the dashboard proxy when Redis is healthy).

Configure **either or both** OAuth providers in `.env.local` when you want real identities; they are omitted from this example’s sign-in UI until both client id **and** secret are set.

### Zero-configuration local run (`next dev`)

1. `npm install`
2. `npm run dev` (no `.env.local` required)
3. Open [http://localhost:3000](http://localhost:3000); use **Load all three** on the home page **without signing in**.
4. For `/dashboard`: you are redirected to sign-in → **Continue as demo user** → no Google/GitHub apps and no OAuth env vars needed.

Demo sign-in uses a repo-known fallback `AUTH_SECRET` for cookie signing (**not secret** across clones — fine for scratching locally). When you OAuth **or** deploy anywhere shared, generate your own **`AUTH_SECRET`**.

Production (`next build` / `next start`): demo login is **off** unless **`AUTH_ALLOW_DEMO=true`** (still not for real accounts). Prefer OAuth vars or a proper secret in deployed environments.

---

## Setup (OAuth + optional `.env`)

1. **`AUTH_SECRET`** (recommended as soon as you leave pure local scratching)

   Random string Auth.js uses to encrypt cookies/JWT slices — see [`AUTH_SECRET`](https://authjs.dev/getting-started/environment-variables).

   ```bash
   openssl rand -base64 32
   ```

2. **`AUTH_ALLOW_DEMO`** — set to `true` only if you need the passwordless demo user in a production **preview**.

3. *(Optional)* **Copy env template** if you maintain many variables locally:

   ```bash
   cp .env.local.example .env.local
   ```

4. **Google OAuth** ([Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth client ID → Web application)

   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
   - Put **Client ID** / **secret** into `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

5. **GitHub OAuth** ([Settings → Developer settings → OAuth Apps](https://github.com/settings/developers))

   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
   - Put **Client ID** / **Client secret** into `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`.

6. **Run** (pick a Mockifyer mode — see table below)

   ```bash
   npm run dev
   ```

   Home page demos use **Load all three** via open routes — no sign-in. The **dashboard** uses authenticated `/api/demo/*` after OAuth or demo login.

### Optional: Local Redis (Docker)

For **`npm run dashboard:redis`** and **`npm run dev:proxy*`**, Redis must listen on **`127.0.0.1:6379`**:

```bash
npm run redis:up
```

Stop when finished:

```bash
npm run redis:down
```

## Mockifyer modes (`package.json`)

| Script | Purpose |
|--------|---------|
| `npm run dev` / `dev:mock` | Filesystem mocks under `./mock-data`, **replay** (`MOCKIFYER_RECORD=false`), **Turbopack** |
| `npm run dev:webpack` | Same as `dev` but **webpack** dev server (matches production bundling / externals) |
| `npm run dev:record` | Same, but **record** real responses into `./mock-data` |
| `npm run dev:proxy` | Prefer **mockifyer-dashboard** `/api/proxy` (start `npm run dashboard:redis` first) |
| `npm run dev:proxy:record` | Proxy mode + record on miss |
| `npm run dev:off` | **No** Mockifyer — plain `fetch` |
| `npm run dashboard` | Dashboard UI on port **3002** (filesystem provider) |
| `npm run dashboard:redis` | Dashboard with Redis (for `dev:proxy*`) |

Environment knobs:

- `MOCKIFYER_PATH` — mock root (default `./mock-data` resolved from cwd)
- `MOCKIFYER_PROXY_URL` — dashboard origin for proxy mode (default `http://localhost:3002`)
- `MOCKIFYER_SCENARIO` — active scenario folder under `mock-data` (same as core docs)

## Layout

- `instrumentation.ts` — Node-only bootstrap; awaits `lib/mockifyer-server-init.ts`
- `lib/mockifyer-server-init.ts` — `MOCKIFYER_RUNTIME` → `off` | `filesystem` | `proxy`
- `auth.ts` + `app/api/auth/[...nextauth]/route.ts` — Auth.js (**Google/GitHub OAuth** + optional **demo Credentials** provider `demo`; see `lib/auth-constants.ts`)
- `app/api/demo/*` — three upstream calls (JSONPlaceholder, GitHub, Dog API), **auth required**
- `app/api/open/demo/*` — same upstreams, **unauthenticated** (used on the home page so you can record without signing in)
- **`next.config.ts`** — `serverExternalPackages` plus **webpack** `externals` so Mockifyer (`fs`, optional providers) is not bundled for the instrumentation hook. Use **`npm run dev:webpack`** if Turbopack warns about webpack-only config.
- `middleware.ts` — Auth.js `auth()`, redirect to `/sign-in` except `/`, `/sign-in`, `/api/auth/*`, `/api/open/*`
- **`export const dynamic = 'force-dynamic'`** in `app/layout.tsx` so static export does not require Auth.js cookies at build time
- **`SessionProvider`** in `components/session-provider.tsx` so the sign-in buttons can call `signIn(...)` client-side — see README above for configuring providers

## Note on client-side HTTP

The **home page** uses open **`/api/open/demo/*`** routes (no sign-in); the **dashboard** uses authenticated **`/api/demo/*`**. Both run **server** `fetch`, so Mockifyer applies the same way. Calling third-party URLs directly from the browser would bypass Mockifyer.
