# Mockifyer


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
| [`@sgedda/mockifyer-fetch`](./packages/mockifyer-fetch) | **`fetch` / React Native** — recommended for Expo and `global.fetch` |
| [`@sgedda/mockifyer-axios`](./packages/mockifyer-axios) | **Axios** interceptors (Node and browser) |
| [`@sgedda/mockifyer-dashboard`](./packages/mockifyer-dashboard) | Local UI to browse/edit `mock-data` (optional; separate dev server) |

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
// Intercepted when MOCKIFYER_ENABLED=true and mocks exist / record mode configured

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
| `MOCKIFYER_ENABLED` | Master switch for mocking layer |
| `MOCKIFYER_RECORD` | Record real responses (fetch/axios packages) |
| `MOCKIFYER_PATH` | Mock data root (legacy name; often `mockDataPath` in config) |
| `MOCKIFYER_SCENARIO` | Active scenario name |
| `MOCKIFYER_USE_SIMILAR_MATCH` | Path-based fallback matching |
| `MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE` | Verify response when similar-matching |
| `MOCKIFYER_ACTIVATION_MODE` | `always` \| `client_id_header` \| `off` — when interceptors run (overrides `activationMode` in config) |

See `@sgedda/mockifyer-core` `ENV_VARS` and package READMEs for the full set.

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

Contributions welcome via Pull Request.

## License

MIT
