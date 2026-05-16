# Mockifyer

**Hosted site:** [mockifyer.up.railway.app](https://mockifyer.up.railway.app/) — public **playground / live demo** of the Mockifyer **dashboard**: explore the UI, how mocks and scenarios are presented, and the overall workflow **without cloning this repo**. It runs on Railway; the URL may change when a stable domain is set up. To **use Mockifyer in your own app**, install the npm packages below (the hosted app is for trying the product, not a hosted backend for your code).

**Contact:** **Sebastian Gedda** ([@sgedda](https://github.com/sgedda)) — [open an issue](https://github.com/sgedda/mockifyer/issues) for bugs and ideas, or a [pull request](https://github.com/sgedda/mockifyer/pulls) if you already have a change. General GitHub profile: [@sgedda](https://github.com/sgedda).

API mocking and recording for **axios** and **fetch**, with date manipulation for tests. Mock data lives in your repo as JSON (per request/response), with optional **scenarios** and React Native / Expo support.
Monorepo for **Mockifyer**: libraries for mocking and recording API calls, with special support for date manipulation in tests.

Published packages (install these, not the repo root):

- `@sgedda/mockifyer-core` — types, providers, `getCurrentDate`, etc.
- `@sgedda/mockifyer-axios` — Axios integration (`setupMockifyer`)
- `@sgedda/mockifyer-fetch` — `fetch` integration (`setupMockifyer`)
- `@sgedda/mockifyer-dashboard`, `@sgedda/mockifyer-test-helper` — optional tooling

The root `package.json` is private workspace metadata only (not published). The legacy package is not on [npm](https://www.npmjs.com/); on **GitHub Packages** it appears as [`pkgs/npm/mockifyer`](https://github.com/sgedda/mockifyer/pkgs/npm/mockifyer) (unscoped name `mockifyer` in the API). To remove versions: `scripts/delete-github-packages-legacy-mockifyer.sh` (needs `gh` + `delete:packages`).

This repository is a **monorepo**. Prefer the scoped packages below; the root `package.json` is legacy workspace metadata.

## Packages

| Package | Use case |
|---------|----------|
| [`@sgedda/mockifyer-core`](./packages/mockifyer-core) | Types, providers (filesystem, Expo, hybrid, memory), scenarios, date helpers, mock matching |
| [`@sgedda/mockifyer-fetch`](./packages/mockifyer-fetch) | **`fetch` / React Native** — `setupMockifyer`, **`initMockifyerForDashboardProxy`** (Node) and **`initMockifyerForReactNativeDashboard`** (Expo) for mockifyer-dashboard + Redis |
| [`@sgedda/mockifyer-axios`](./packages/mockifyer-axios) | **Axios** interceptors (Node and browser) |
| [`@sgedda/mockifyer-dashboard`](./packages/mockifyer-dashboard) | Local UI to browse/edit `mock-data` (optional; separate dev server) |

**Initializing Mockifyer (all entrypoints):** **[MOCKIFYER_INITIALIZATION.md](./MOCKIFYER_INITIALIZATION.md)**.

**React Native / Expo:** see **[REACT_NATIVE.md](./REACT_NATIVE.md)** for Hybrid provider, Metro sync middleware, and `setupMockifyerForReactNative`.

## Installation

```bash
npm install @sgedda/mockifyer-core @sgedda/mockifyer-axios
# or for fetch:
# npm install @sgedda/mockifyer-core @sgedda/mockifyer-fetch
```

## Usage (fetch)

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-axios';
import { getCurrentDate } from '@sgedda/mockifyer-core';

setupMockifyer({
  mockDataPath: './mock-data',
  dateManipulation: {
    fixedDate: '2024-01-01T00:00:00.000Z',
  },
});

const response = await fetch('https://api.example.com/data');
// Intercepted when setupMockifyer ran (Node); RN uses MOCKIFYER_MODE — see REACT_NATIVE.md

const currentDate = getCurrentDate();
console.log(currentDate.toISOString()); // 2024-01-01T00:00:00.000Z
```

## Usage (axios)

```typescript
import { setupMockifyer, getCurrentDate } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data',
  dateManipulation: {
    fixedDate: '2024-01-01T00:00:00.000Z',
  },
});

const response = await axios.get('https://api.example.com/data');
```

**Date manipulation:** use **`getCurrentDate()`** from the same package you use for `setupMockifyer` instead of `new Date()`, so fixed date / offset / timezone apply.

## Features

- Record and replay HTTP requests (axios or fetch)
- Automatic interception driven by env + config
- **Scenarios** — `mock-data/<scenario>/...` plus `scenario-config.json`
- Date manipulation (fixed date, offset, timezone) for tests
- **Easy discovery** — JSON files in the repo (searchable in your IDE)
- **React Native** — device storage + optional Metro sync to keep repo and simulator in sync ([REACT_NATIVE.md](./REACT_NATIVE.md))

## Data discovery

Recorded mocks are stored as JSON (nested under `mock-data/<scenario>/` when scenarios are used). Each file typically includes:

- **Request:** method, URL, headers, query params, body
- **Response:** status, body, headers
- **Metadata:** timestamp, optional `scenario`

File layout on disk often mirrors host and path (e.g. `api.example.com/rest/.../GET_identifier_timestamp.json`). See packages for exact naming rules (`file-naming` utilities in core).

## Date configuration

Same ideas as before: `fixedDate`, `offset`, `timezone` in `setupMockifyer`, or env vars:

```bash
export MOCKIFYER_DATE="2025-01-01T00:00:00Z"
export MOCKIFYER_DATE_OFFSET="86400000"
export MOCKIFYER_TIMEZONE="America/New_York"
```

Priority: env vars → `setupMockifyer` config → system time.

## Environment variables (common)

| Variable | Description |
|----------|-------------|
| `MOCKIFYER_MODE` | React Native startup: `on` \| `launch_client` \| `off` (see `MockifyerRuntimeMode` in core; **unset defaults to `on`**) |
| `MOCKIFYER_RECORD` | Record real responses (fetch/axios packages) |
| `MOCKIFYER_PATH` | Mock data root (legacy name; often `mockDataPath` in config) |
| `MOCKIFYER_SCENARIO` | Active scenario name |
| `MOCKIFYER_STRICT_SCENARIO` | **`true`/…** — fetch/RN dashboard-proxy mode: bypass Mockifyer until **`clientId`** or **`proxy.scenario`** is set (requires **`proxy.baseUrl`**) |
| `MOCKIFYER_STRICT_LANE_SCENARIO` | Lane-only proxy scenario: no global/filesystem fallback when **`clientId`** is set and lane mapping is missing. **Default `true`** on dashboard and in SDK when **`proxy.baseUrl`** is set. Set **`false`** or **`proxy.strictLaneScenario: false`** in init to allow global fallback. SDK sends **`strictLaneScenario`** on each proxy POST. |
| `MOCKIFYER_USE_SIMILAR_MATCH` | Path-based fallback matching |
| `MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE` | Verify response when similar-matching |
| `MOCKIFYER_ACTIVATION_MODE` | `always` \| `client_id_header` \| `off` — when interceptors run (overrides `activationMode` in config) |


See `@sgedda/mockifyer-core` `ENV_VARS` and package READMEs for the full set.

## Scenario name precedence

### SDK / filesystem (`getCurrentScenario` — local mocks, fallbacks)

| Priority | Source |
| :--- | :--- |
| 1 | **`MOCKIFYER_SCENARIO`** env |
| 2 | **`MockifyerConfig.defaultScenario`** or **`scenarios.default`** ( **`defaultScenario`** wins when both are set ) |
| 3 | **`scenario-config.json`** (preferred: **`scenario-config.{clientId}.json`** when that file exists ) |
| 4 | **`default`** folder name |

### Dashboard Redis **`/api/proxy`** (effective scenario used for mocks and recordings )

Per proxied request: **`scenario`** in the POST body (**client override**) **→** **`client_scenario:{clientId}`** **→** Redis **`active_scenario`** **→** filesystem seed via **`getCurrentScenario`** on the dashboard.

With strict lane (default when using the dashboard proxy): non-empty **`clientId`** plus missing **`client_scenario:{clientId}`** ⇒ upstream passthrough only (no global **`active_scenario`**). Configure per app via **`proxy.strictLaneScenario`** in **`setupMockifyer`** / **`setupMockifyerForReactNative`** (overridable with **`MOCKIFYER_STRICT_LANE_SCENARIO`** env).

For optional app escape hatches (**`proxy.scenario`** SDK / proxy body **`scenario`**), **`last seen resolved`** in the Client Lanes UI can diverge from the configured lane scenario.



## Activation modes (when interceptors run)

Use `activationMode` on `setupMockifyer(...)` (or env **`MOCKIFYER_ACTIVATION_MODE`**) to control whether **each outbound request** goes through mock lookup and recording. Env wins over config when set to a valid value.

| Mode | Behavior |
|------|----------|
| **`always`** (default) | Same as before: every request uses Mockifyer, subject to `excludedUrls` and built-in bypasses (e.g. Mockifyer Metro sync URLs). |
| **`client_id_header`** | Mockifyer runs only when the outbound request carries a **non-empty** **`X-Mockifyer-Client-Id`** header. Omit the header for a normal real HTTP call; set it (or receive it from an upstream service) to opt that hop into mocks/recording. **Fetch + dashboard proxy:** if `proxy.baseUrl` is set and a **resolved `clientId`** exists, proxy traffic is treated as opted-in even when the inner URL headers do not repeat the field (the lane is sent on the proxy `POST`). |
| **`off`** | Interceptors do not apply mock or record behavior; plain HTTP. |

**Axios example (header-gated):**

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data',
  activationMode: 'client_id_header',
  recordMode: false,
});

// Bypasses Mockifyer (no header)
await axios.get('https://api.example.com/health');

// Uses Mockifyer for this request
await axios.get('https://api.example.com/v1/profile', {
  headers: { 'X-Mockifyer-Client-Id': 'ci-lane-eu-1' },
});
```

**Fetch example:** same `activationMode: 'client_id_header'` in `setupMockifyer` from `@sgedda/mockifyer-fetch`; pass `headers: { 'X-Mockifyer-Client-Id': '<lane>' }` on `fetch` calls that should replay or record.

**Multi-service flows:** have the caller set `X-Mockifyer-Client-Id` on HTTP requests to a downstream service that runs Mockifyer with `client_id_header`, so only traffic that is part of the mock/test graph is intercepted.

**Dashboard proxy:** when the dashboard proxies to the real upstream, it sets **`X-Mockifyer-Client-Id`** on that upstream request when a lane `clientId` is resolved, so downstream APIs can apply the same rule. See [MULTI_CLIENT_ISOLATION.md](./MULTI_CLIENT_ISOLATION.md) for lane and proxy context.

Implementation helpers (for custom middleware): `resolveActivationMode`, `shouldApplyMockifyer`, `getOutboundMockifyerClientIdHeader`, and `MOCKIFYER_CLIENT_ID_HEADER` are exported from `@sgedda/mockifyer-core`.

## Advanced testing

Combine Mockifyer (HTTP + dates) with [Sinon](https://sinonjs.org/) for spies/stubs on your own code: [Testing with Sinon](./packages/mockifyer-core/TESTING_WITH_SINON.md).

## Contributing

Issues and pull requests are welcome — use the **Contact** links at the top of this README ([Issues](https://github.com/sgedda/mockifyer/issues), [PRs](https://github.com/sgedda/mockifyer/pulls)).

## Maintainer

**Mockifyer** is maintained by **Sebastian Gedda** ([@sgedda](https://github.com/sgedda)). Prefer GitHub **[Issues](https://github.com/sgedda/mockifyer/issues)** and **[pull requests](https://github.com/sgedda/mockifyer/pulls)** so discussions stay searchable for everyone.

## Trademark

**Mockifyer** is the project **brand**. The [MIT License](LICENSE) grants permissions for the **software** in this repository; it does **not** grant rights to use the name **Mockifyer** in a way that implies affiliation, endorsement, or an official product without separate agreement.

## License

[MIT](LICENSE)
