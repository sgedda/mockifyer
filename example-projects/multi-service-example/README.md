# Multi-service Mockifyer example

Next.js UI plus three small Express APIs: gateway + catalog use **fetch** (`@multi-service/mock-bootstrap`), relay uses **axios** (`@multi-service/mock-axios-bootstrap`). Next uses `apps/web/lib/mockifyer-server-init.ts` (see Turbopack note there). Use the **same** `MOCKIFYER_CLIENT_ID` and **`MOCKIFYER_PATH`** everywhere so filesystem scenario selection (and Redis lane mapping where supported) lines up.

## Flow

1. Browser → `GET /api/demo/chain` on the Next app (**3040**)
2. Route handler → `GET http://127.0.0.1:4101/aggregate` (**gateway-api**, Mockifyer + **fetch**)
3. Gateway → `GET http://127.0.0.1:4103/via-axios` (**relay-axios-api**, Mockifyer + **axios** → catalog)
4. Relay → `GET http://127.0.0.1:4102/product` (**catalog-api**, Mockifyer + **fetch**), forwarding `x-mockifyer-client-id` when `MOCKIFYER_CLIENT_ID` is set
5. Catalog → `https://jsonplaceholder.typicode.com/posts/1` (mockable upstream)

## Prerequisites

- Node 20+
- **Docker** (optional): for local Redis used by `dashboard:redis`
- From this directory, install once:

```bash
npm install
```

### Local Redis (Docker)

Start Redis on **`127.0.0.1:6379`** (matches `npm run dashboard:redis`):

```bash
npm run redis:up
```

Stop when done:

```bash
npm run redis:down
```

If Redis is not running, `dashboard:redis` will fail to connect—use `npm run redis:up` first (or point `MOCKIFYER_REDIS_URL` at another instance).

## Run all services

```bash
npm run dev
```

Open [http://127.0.0.1:3040](http://127.0.0.1:3040) and click **Run chain**.

### Run processes individually

```bash
npm run dev:catalog   # port 4102
npm run dev:relay     # port 4103 (axios relay)
npm run dev:gateway   # port 4101
npm run dev:web       # port 3040 (start backends first or use `npm run dev`)
```

## Record mocks

`packages/mock-bootstrap` only enables recording when **`MOCKIFYER_RECORD=true`** in **that process**. Plain `npm run dev` leaves `MOCKIFYER_RECORD` unset, which behaves like **off** (`=== 'true'` is false).

To capture **each outbound HTTP hop** (web→gateway, gateway→relay, relay→catalog, catalog→JSONPlaceholder) into `mock-data/<scenario>/`:

```bash
npm run dev:record
```

This sets `MOCKIFYER_RECORD=true` once at the repo root; workspace **`dev`** scripts do **not** override it (they must not pass `MOCKIFYER_RECORD=false`, or recording would never stick).

Then open the UI and run the chain once. Or record one service only, e.g. catalog:

```bash
npm run dev:record -w @multi-service/catalog-api
```

### Replay stops the chain before axios

If Mockifyer logs **`Mock hit: GET http://127.0.0.1:4101/aggregate`**, the Next server **never opens a real TCP connection** to the gateway: it returns the saved JSON from `mock-data/<scenario>/`. So **gateway → relay (axios) → catalog never runs** until that mock is removed or you miss (e.g. delete `*GET_*4101*aggregate*.json` under the active scenario, use another scenario, or temporarily rename `mock-data/default`).

After adding **relay-axios-api**, old aggregate mocks may still match the same URL but embed an outdated shape—delete them if you want to exercise the full live chain.

### Next.js telemetry mocks

With Mockifyer patching global `fetch`, **Next telemetry** can be recorded too. Dev scripts set **`NEXT_TELEMETRY_DISABLED=1`** to reduce noise; delete `*telemetry_nextjs_org*` files from `mock-data` if they already exist.

### Catalog `/product` in mock filenames

Mockifyer persists **outbound** requests only. The Express route **`/product`** on catalog is **incoming** traffic; it does not create its own mock entry. The relay→catalog leg appears as a filename containing **`4102`** (catalog’s port) and **`product`** (the path), e.g. `…GET_127_0_0_1_4102_product.json`.

If you see **`4103_via-axios`** but **no `4102`/`product` file**, axios was usually running **without** Mockifyer interceptors on the instance your code uses (typical with **`import axios`** in ESM while Mockifyer patched `require('axios')`). This workspace passes **`axiosInstance`** from `import axios from 'axios'` into `@multi-service/mock-axios-bootstrap`. While **`MOCKIFYER_RECORD=true`**, bootstrap also sets **`recordSameEndpoints`** so an older **fetch** mock for the same catalog URL does not prevent axios from hitting the network and saving.

## Dashboard

Local filesystem UI (no Redis):

```bash
npm run dashboard
```

Redis-backed dashboard + proxy preset:

```bash
npm run dashboard:redis
```

Then run **`npm run dev:proxy`** or **`npm run dev:proxy:record`** from this folder (sets `MOCKIFYER_RUNTIME=proxy` and `MOCKIFYER_PROXY_URL=http://127.0.0.1:3002` on **web**, **gateway**, **catalog**, and **relay** for the catalog hop). Inbound correlation is installed by **`setupMockifyer`** (`installNodeInboundRequestCorrelationCapture`); Express services also mount **`createMockifyerCorrelationMiddleware`** for clarity. Patched **`fetch`** propagates lane + parent request ids (no manual headers in routes). **relay-axios-api** uses **axios + filesystem** in `dev` / `dev:record`; in **`dev:proxy`** it uses **fetch + dashboard proxy** for `GET /product` only (`mockifyer-axios` has no `/api/proxy` client yet).

### Dashboard network tab shows only one URL?

The **Network** view lists **dashboard `/api/proxy` upstream URLs**, not every Express route.

With **`MOCKIFYER_RUNTIME=proxy`**, the SDK routes through **`/api/proxy`** and does **not** replay from local `mock-data` first (that only applies to **`filesystem`** mode). If you still see **`[Mockifyer-Fetch] Mock hit: …mock-data/default/…`** on web, init likely **fell back to filesystem** (dashboard Redis health check failed — start `npm run redis:up` and `npm run dashboard:redis` before `dev:proxy`).

A single Network row like **`http://127.0.0.1:4101/aggregate`** often means the chain **stopped at a mock hit inside the dashboard** (Redis/disk) for that URL, so relay/catalog never ran live.

1. **Clear the aggregate mock** so the proxy calls the real gateway:
   ```bash
   npm run chain:clear-gateway-mock
   ```
   Or delete files under `mock-data/default/` whose names contain `4101` and `aggregate`. If you recorded into **Redis**, remove the same hash in the dashboard or use a fresh scenario/lane.
2. **Select lane** `multi-service-demo` in the dashboard (matches `MOCKIFYER_CLIENT_ID` in workspace `dev` scripts).
3. Run the chain again with **`npm run dev:proxy:record`** (Redis up, `npm run dashboard:redis`).
4. After a **live** run you should see multiple proxy URLs, e.g. `…4101/aggregate`, `…4103/via-axios`, `…4102/product`, and `jsonplaceholder.typicode.com/…` (exact set depends on mocks still on disk/Redis).

`setupMockifyer` also enables Node inbound capture; **`createMockifyerCorrelationMiddleware`** is optional on Express when auto-install is on.

## Layout

| Path | Role |
|------|------|
| `apps/web` | Next.js App Router + instrumentation |
| `apps/web/lib/mockifyer-server-init.ts` | Same bootstrap as mock-bootstrap; imports Mockifyer via **relative** paths into `packages/*` so Turbopack can resolve them (hoisted `node_modules` alone is not enough from this app). |
| `services/gateway-api` | Fetch-based hop → relay |
| `services/relay-axios-api` | **Axios** (filesystem) or **fetch proxy** (when `MOCKIFYER_RUNTIME=proxy`) → catalog |
| `services/catalog-api` | Fetch-based hop → JSONPlaceholder |
| `packages/mock-bootstrap` | Shared bootstrap for fetch (`tsx`) |
| `packages/mock-axios-bootstrap` | Shared bootstrap for axios (`tsx`; filesystem / off only in this example) |

See `.env.example` for tunables.
