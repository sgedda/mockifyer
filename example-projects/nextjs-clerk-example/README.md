# Next.js + Clerk + Mockifyer

Full-stack example: [Clerk](https://clerk.com/) auth, an App Router **dashboard** that triggers several **Route Handlers**, each calling a different public API with server-side `fetch`. [Mockifyer](https://github.com/sgedda/mockifyer) runs in the **Node** process via root [`instrumentation.ts`](https://nextjs.org/docs/app/guides/instrumentation), so `fetch` in `app/api/**` is recorded or replayed from disk (or via the dashboard proxy when Redis is healthy).

## Setup

1. **Clerk** — create an app in the Clerk dashboard and set keys (see [Clerk Next.js docs](https://clerk.com/docs)):

   ```bash
   cp .env.local.example .env.local
   # fill NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY
   ```

2. **Install**

   ```bash
   npm install
   ```

3. **Run** (pick a Mockifyer mode — see table below)

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) and use **Load all three** (or individual buttons) on the home page — no sign-in needed for that. Or sign in and use the **Dashboard** for the same upstreams via `/api/demo/*`.

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
|--------|--------|
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
- `app/api/demo/*` — three upstream calls (JSONPlaceholder, GitHub, Dog API), **auth required**
- `app/api/open/demo/*` — same upstreams, **unauthenticated** (used on the home page so you can record without signing in)
- **`next.config.ts`** — `serverExternalPackages` plus **webpack** `externals` so Mockifyer (`fs`, optional providers) is not bundled for the instrumentation hook. Use **`npm run dev:webpack`** if Turbopack warns about webpack-only config.
- `middleware.ts` — Clerk `auth.protect()` except `/`, `/sign-in`, `/sign-up`, and `/api/open/demo/*`
- **`export const dynamic = 'force-dynamic'`** in `app/layout.tsx` so static export does not require real Clerk keys at build time; use real keys from [Clerk](https://dashboard.clerk.com) for local sign-in.

## Note on client-side HTTP

The **home page** uses open **`/api/open/demo/*`** routes (no sign-in); the **dashboard** uses authenticated **`/api/demo/*`**. Both run **server** `fetch`, so Mockifyer applies the same way. Calling third-party URLs directly from the browser would bypass Mockifyer.
