# Mockifyer initialization guide

Reference for **how to start Mockifyer** in each runtime: primitives (full config) versus **presets** (opinionated defaults).  
Related: **[REACT_NATIVE.md](./REACT_NATIVE.md)** (Expo/Metro/Hybrid), **[DATABASE_PROVIDER.md](./DATABASE_PROVIDER.md)** (storage backends), **`mockifyer-dashboard`** [README](./packages/mockifyer-dashboard/README.md), **[MOCK_WORKFLOW.md](./MOCK_WORKFLOW.md)** (recording vs curated mocks, re-record without losing edits).

---

## Fetch (`@sgedda/mockifyer-fetch`)

### `setupMockifyer(config)`

> **Use when:** You need full control (custom `databaseProvider`, `proxy`, `activationMode`, test generation, date manipulation, exclusions, strict lane/scenario flags, etc.).  
> **Why:** Everything composes through one `MockifyerConfig`; this is the stable baseline all helpers call internally.

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  mockDataPath: './mock-data',
  useGlobalFetch: true,
  recordMode: false,
  proxy: {
    baseUrl: 'http://localhost:3002',
    scenario: 'default',
    recordOnMiss: true,
  },
  databaseProvider: { type: 'memory' },
  clientId: process.env.MOCKIFYER_CLIENT_ID,
});
```

**Record on miss (`/api/proxy`):**

| `proxy.recordOnMiss` | Behavior |
|----------------------|----------|
| `true` | Request body includes `"record": true` (force recording on miss when the server allows). |
| `false` | Includes `"record": false` (this client never persists proxy misses). |
| Omitted | **`record` is omitted** — Redis dashboard uses the **per-scenario** Settings toggle. Env **`MOCKIFYER_PROXY_RECORD_ON_MISS`** (`true` / `false`) can set the client flag when omitted. |

> **Behavior change (fetch):** Older versions defaulted `record` to **`false`** when `proxy.recordOnMiss` was omitted, so the dashboard “Record on miss” toggle had no effect. Omitted now **defers to the dashboard** (and the server default is to record on miss). To keep the old “never record” behavior without touching the dashboard, set **`proxy: { ..., recordOnMiss: false }`** or **`MOCKIFYER_PROXY_RECORD_ON_MISS=false`**.

**After a new recording is saved:** the mock includes the real **response body** but defaults **`alwaysUseRealApi: true`** (“Always use live API” checked in the dashboard) so the next matching calls keep hitting the real API until you uncheck to replay from the fixture. Set **`MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API=false`** to restore immediate mock replay after capture.

**React Native** (`setupMockifyerForReactNative`): still sends an explicit boolean — `proxyRecordOnMiss ?? recordMode` — so a dev build with `recordMode: false` does not start writing to Redis unless you opt in.

---

### `initMockifyerForDashboardProxy(options)` (**async**)

> **Use when:** Outbound **`fetch`** should go through **mockifyer-dashboard** (`POST /api/proxy`) when **`GET /api/health`** reports **`provider: redis`** and **`redisOk`**. Matches **React Native** resilience: if the dashboard is down, on a non-Redis provider, or Redis isn’t ready, the preset **drops `proxy`** and uses **filesystem mocks** under `mockDataPath` (+ normal **`recordMode`** disk saves).  
> **Why:** Remote/stopped dashboards are common from Node too; this avoids a half-broken “proxy always on” preset. Use **`skipDashboardRedisHealthCheck: true`** to restore the old behavior (always set `proxy`). You can also call **`canUseDashboardRedisProxy(baseUrl)`** yourself.

```typescript
import { initMockifyerForDashboardProxy } from '@sgedda/mockifyer-fetch';

await initMockifyerForDashboardProxy({
  dashboardBaseUrl: 'http://localhost:3002',
  mockDataPath: './mock-data',
  clientId: process.env.MOCKIFYER_CLIENT_ID,
  scenario: 'default',
  recordOnMiss: true,
});
```

Force proxy without health probe (CI that must fail at HTTP layer if dashboard is wrong, or trust the URL):

```typescript
await initMockifyerForDashboardProxy({
  dashboardBaseUrl: process.env.MOCKIFYER_PROXY_URL!,
  skipDashboardRedisHealthCheck: true,
});
```

Advanced overrides without re-specifying everything:

```typescript
await initMockifyerForDashboardProxy({
  dashboardBaseUrl: 'http://localhost:3002',
  config: { logging: 'debug', excludedUrls: [] },
});
```

---

### `initMockifyerForLocalFilesystem(options?)`

> **Use when:** Mocks live as **JSON on disk** under a folder (e.g. `./mock-data`); **no** mockifyer-dashboard and **no** Redis proxy hop. Fits **local development**, **simple CI replay**, or “clone repo → run tests” workflows.  
> **Why:** Avoids accidental `proxy` wiring; aligns with the default filesystem layout and `MOCKIFYER_PATH` env.

```typescript
import { initMockifyerForLocalFilesystem } from '@sgedda/mockifyer-fetch';

initMockifyerForLocalFilesystem({
  mockDataPath: './mock-data',
  useGlobalFetch: true,
  recordMode: process.env.MOCKIFYER_RECORD === 'true',
});
```

---

### Redis on the Node process (`databaseProvider.type === 'redis'`)

> **Use when:** The **same Node process** should read/write mocks in **Redis** via **`ioredis`**—not HTTP to the dashboard. Common for backends that already bundle Redis clients. Requires **`npm install ioredis`**.  
> **Why:** No dashboard HTTP hop; use **`setupMockifyer`** (not the dashboard presets) so you control URL, key prefix, and scenario fallbacks. See core types on `databaseProvider`.

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  mockDataPath: './mock-data',
  useGlobalFetch: true,
  databaseProvider: {
    type: 'redis',
    path: process.env.MOCKIFYER_REDIS_URL ?? 'redis://127.0.0.1:6379',
    options: {
      mockDataPath: './mock-data',
      keyPrefix: 'mockifyer:v1',
    },
  },
});
```

*(You may still combine with `proxy` if some traffic should hit the dashboard; most teams choose **either** in-process Redis **or** dashboard proxy for clarity.)*

---

## Axios (`@sgedda/mockifyer-axios`)

### `setupMockifyer(config)`

> **Use when:** The app uses **Axios** instead of `global.fetch`. Mockifyer wires **interceptors**; configuration is the same **`MockifyerConfig`** shape as much of the ecosystem (paths, scenarios, `recordMode`, etc.).  
> **Why:** There is no separate “axios dashboard preset” in the package today—use **`setupMockifyer`** and set **`useGlobalAxios`** / instance as needed. Dashboard-style HTTP proxy is primarily documented around **`@sgedda/mockifyer-fetch`**; if you need dashboard proxy with Axios, keep using shared env/scenario conventions or open a feature request.

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data',
  useGlobalAxios: true,
  recordMode: false,
});
```

---

## React Native / Expo (`@sgedda/mockifyer-fetch`)

Import from **`@sgedda/mockifyer-fetch`** or **`@sgedda/mockifyer-fetch/react-native`** (Metro may resolve RN entry).

### MOCKIFYER_MODE compared to lane and scenario (two layers)

These are **different layers**. Confusing them is a common source of bugs.

#### 1. **`MOCKIFYER_MODE`** (`runtimeMode`) — **startup only** (`setupMockifyerForReactNative`)

Controls whether **`global.fetch` is patched at all** when your init runs. It does **not** mean “wait until a dashboard lane is connected.” Plain **`setupMockifyer`** / Axios **do not read `MOCKIFYER_MODE`** in this repo.

**Canonical values** (`MockifyerRuntimeMode`):

| Value | Meaning |
|------|---------|
| **`on`** | Activate Mockifyer when the RN helper runs (patch `fetch`). |
| **`off`** | Do **not** activate; **`not_activated`**; native launch args do **not** bypass this (use for store builds that ship SDK code but must never intercept). |
| **`launch_client`** | Activate **only if** native launch arguments include a non-empty **`mockifyerClientId`** (or custom **`launchArgumentClientIdKey`**) via optional peer **`react-native-launch-arguments`** — typical **Maestro / XCTest**. |

**Aliases** (normalized in **`resolveMockifyerRuntimeMode`**): `disabled` \| `none` → **`off`**; `enabled` \| `always` → **`on`**; `e2e` \| `maestro` \| `launch-client` → **`launch_client`**.

**Resolution order:** config **`runtimeMode`** → env **`MOCKIFYER_MODE`** → default **`on`** if unset.

**Important:** **`launch_client` does not look at** **`MOCKIFYER_CLIENT_ID`**, **`config.clientId`**, or “lane connected” in the dashboard UI — only **native launch args** at startup count for this gate. For “activate when env lane is set,” use **`on`** (default) and set **`MOCKIFYER_CLIENT_ID`** / **`clientId`** in merged config **after** activation.

#### 2. **Strict proxy scenario** — **per-request**, optional

Separate from **`MOCKIFYER_MODE`**. When **`strictScenarioResolution`** is **`true`** (or **`MOCKIFYER_STRICT_SCENARIO=true`**) **and** **`proxy.baseUrl`** is set, **`fetch`** interception **skips** Mockifyer (plain passthrough) until **`clientId`** **or** **`proxy.scenario`** is set — see **`isExplicitProxyScenarioContext`** in **`@sgedda/mockifyer-core`**.

When there is **no proxy** (e.g. Hybrid / filesystem-only dev), or strict mode is **off**, **`MOCKIFYER_MODE=on`** does **not** require a lane before intercepting.

#### 3. **`MOCKIFYER_ACTIVATION_MODE`** — **per-request** slice

Yet another axis: e.g. **`client_id_header`** only runs Mockifyer when **`X-Mockifyer-Client-Id`** is present (unless proxy lane rules opt traffic in). See **`README.md`** and **`activationMode`** on **`MockifyerConfig`**.

---

### `setupMockifyerForReactNative(options)`

> **Use when:** You want the **recommended** RN flow out of the box—**Hybrid** + Metro sync in **development**, **bundled mocks** + **Memory** in **production**, optional **`proxyBaseUrl`** when the dashboard is healthy (**strict Redis proxy** branch). Activation via **`MOCKIFYER_MODE`**, **`launch_client`**, etc.  
> **Why:** Handles `__DEV__`, provider switching, bundled load path, and optional initial `reloadMockData`; still the primary API for RN.

```typescript
import {
  setupMockifyerForReactNative,
  isMockifyerReactNativeActive,
} from '@sgedda/mockifyer-fetch/react-native';

const result = await setupMockifyerForReactNative({
  isDev: __DEV__,
  mockDataPath: 'mock-data',
  bundledDataPath: './assets/mock-data',
  proxyBaseUrl: process.env.MOCKIFYER_PROXY_URL,
  recordMode: __DEV__ && process.env.MOCKIFYER_RECORD === 'true',
  config: { logging: 'info' },
});

if (isMockifyerReactNativeActive(result)) {
  // result.instance
}
```

---

### `initMockifyerForReactNativeDashboard(options)`

> **Use when:** You standardize on **mockifyer-dashboard + Redis** and want URL resolution spelled out (**`proxyBaseUrl`** → **`dashboardBaseUrl`** → **`MOCKIFYER_PROXY_URL`**) instead of scattering env reads. Same runtime behavior as passing **`proxyBaseUrl`** into **`setupMockifyerForReactNative`**.  
> **Why:** Matches the mental model of **`initMockifyerForDashboardProxy`** on Node and fails fast if no dashboard URL is configured.

```typescript
import { initMockifyerForReactNativeDashboard } from '@sgedda/mockifyer-fetch/react-native';

const result = await initMockifyerForReactNativeDashboard({
  isDev: __DEV__,
  mockDataPath: 'mock-data',
  bundledDataPath: './assets/mock-data',
  dashboardBaseUrl: 'http://localhost:3002', // physical device → use LAN IP
  recordMode: __DEV__ && process.env.MOCKIFYER_RECORD === 'true',
});
```

---

### Bare `setupMockifyer` in RN (advanced)

> **Use when:** You bypass **`setupMockifyerForReactNative`** and assemble **`databaseProvider`** (e.g. **`expo-filesystem`**, **`hybrid`**), **`proxy`**, etc. manually—usually copied from **`packages/mockifyer-core/examples`**.  
> **Why:** Maximum flexibility when the helper’s provider matrix doesn’t match your app.

---

## mockifyer-dashboard (process, not SDK)

> **Use when:** You need the **UI**, **`/api/proxy`** (requires **`--provider redis`**), Redis-backed scenarios, client lanes, or team-shared mock state—not a substitute for **`setupMockifyer`** in code.  
> **Why:** The app still needs **`proxy.baseUrl`** (or presets above) pointing at this server; Redis URL is configured on the **dashboard** process.

```bash
MOCKIFYER_REDIS_URL=redis://127.0.0.1:6379 mockifyer-dashboard --provider redis --path ./mock-data --port 3002
# Local SQLite (no Redis): proxy, lanes, and network log use mockifyer-dashboard.db
# mockifyer-dashboard --provider sqlite --path ./mock-data --port 3002
# Optional: mirror recorded mocks to disk + read disk when store misses (git-friendly fixtures):
# mockifyer-dashboard --provider redis --path ./mock-data --redis-disk-dual --port 3002
# mockifyer-dashboard --provider sqlite --path ./mock-data --redis-disk-dual --port 3002
```

**Redis + disk (version control):** `--redis-disk-dual`, or `--redis-mirror-disk` / `--redis-disk-fallback`, or env `MOCKIFYER_REDIS_MIRROR_DISK` / `MOCKIFYER_REDIS_DISK_READ_FALLBACK`. Recorded mocks are written to `mock-data/<scenario>/redis/<hash>.json`; with fallback, the proxy checks Redis first, then JSON under that scenario folder. Details: **[mockifyer-dashboard README](./packages/mockifyer-dashboard/README.md)**.

**Client-side mirror (app + remote proxy):** In **`@sgedda/mockifyer-fetch`**, set **`proxy.mirrorRecordedMocksToClient: true`** or env **`MOCKIFYER_PROXY_MIRROR_TO_CLIENT=true`**. When the dashboard proxy records to Redis, it returns **`storedMock`**; the SDK writes **`mock-data/<scenario>/redis/<hash>.json`** on the client (Node fs, hybrid/filesystem provider, or Metro **`POST /mockifyer-save`** for strict RN + in-memory). Requires a dashboard build that includes **`recordedToStore`** / **`storedMock`** on **`POST /api/proxy`** responses (current `mockifyer-dashboard`).

---

## Quick pick

| Goal | Initializer |
|------|--------------|
| Full control (`fetch`) | `setupMockifyer` |
| Dashboard + Redis (`fetch`, Node) | `initMockifyerForDashboardProxy` |
| Files only, no dashboard | `initMockifyerForLocalFilesystem` |
| Redis in Node process | `setupMockifyer` + `databaseProvider: { type: 'redis' }` |
| Axios | `setupMockifyer` (axios package) |
| RN default | `setupMockifyerForReactNative` |
| RN + explicit dashboard URL preset | `initMockifyerForReactNativeDashboard` |

---

## Environment variables (common)

| Variable | Role |
|----------|------|
| `MOCKIFYER_MODE` | **RN only** (with **`setupMockifyerForReactNative`**): startup gate — **`on`** \| **`launch_client`** \| **`off`** (see [MOCKIFYER_MODE compared to lane and scenario](#mockifyer_mode-compared-to-lane-and-scenario-two-layers)). Unset → **`on`**. |
| `MOCKIFYER_STRICT_SCENARIO` | When **`true`** and **`proxy.baseUrl`** is set, require **`clientId`** or **`proxy.scenario`** before intercepting (per-request). |
| `MOCKIFYER_RECORD` | Recording: local **`recordMode`** (filesystem saves) and/or preset **`recordOnMiss`** when using **`initMockifyerForDashboardProxy`** (see below) |
| `MOCKIFYER_PROXY_RECORD_ON_MISS` | Fetch + **`proxy.baseUrl`**: when **`proxy.recordOnMiss`** is omitted in config, set to **`true`** or **`false`** to send that `record` flag on `/api/proxy`; if unset, the **`record`** field is omitted and the **dashboard per-scenario** “Record on miss” applies |
| `MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API` | When not **`false`**, each **new recording** sets **`alwaysUseRealApi: true`** (body saved, **live API** until you uncheck in the dashboard). Set **`false`** for legacy replay-immediately behavior |
| `MOCKIFYER_PROXY_URL` | Dashboard base URL for RN presets |
| `MOCKIFYER_PATH` | Mock data root (filesystem / fallbacks) |
| `MOCKIFYER_SCENARIO` | Active scenario name |
| `MOCKIFYER_CLIENT_ID` | Client lane for proxy / isolation (**not** the **`launch_client`** startup gate — use **`on`** if lane comes from env.) |
| `MOCKIFYER_REDIS_URL` | Redis for **dashboard** or **in-process** `redis` provider |
| `MOCKIFYER_REDIS_MIRROR_DISK` | Dashboard (`redis`): write `mock-data/<scenario>/redis/<hash>.json` when proxy records from upstream |
| `MOCKIFYER_REDIS_DISK_READ_FALLBACK` | Dashboard (`redis`): if Redis has no mock, scan scenario JSON on disk before upstream |
| `MOCKIFYER_PROXY_MIRROR_TO_CLIENT` | Fetch SDK: when dashboard proxy records to Redis, also save `mock-data/<scenario>/redis/<hash>.json` on the client (or via Metro on RN) |

See repo **[README.md](./README.md)** and **`MockifyerConfig`** in **`@sgedda/mockifyer-core`** for the full list.
