---
name: mockifyer
description: >-
  Work on the Mockifyer monorepo — HTTP mock record/replay (axios, fetch),
  scenarios, GraphQL matching, dashboard, React Native. Use when editing
  mockifyer packages, mock-data, setupMockifyer, interceptors, or the dashboard.
---

# Mockifyer

## Monorepo map

| Package | Role |
|---------|------|
| `packages/mockifyer-core` | Types, `generateRequestKey`, providers, scenarios, dates, matching |
| `packages/mockifyer-axios` | `setupMockifyer` for Axios |
| `packages/mockifyer-fetch` | `setupMockifyer` for fetch / React Native |
| `packages/mockifyer-dashboard` | Express API + React UI for mocks |
| `packages/mockifyer-test-helper` | Test utilities |
| `mockifyer-web` | Example / demo web app |

Root `package.json` is **private** — publish changes only under `packages/*`.

## Core behavior

- **Record / replay**: intercept HTTP → match stored JSON mock → return saved response or call real API when recording.
- **Mock data**: `mock-data/<scenario>/` (JSON per request). Active scenario from env, `scenario-config.json`, or dashboard (Redis lanes).
- **Dates in tests**: use `getCurrentDate()` from the same package as `setupMockifyer`, not `new Date()`.
- **Matching key** (`generateRequestKey` in `mock-matcher.ts`): `METHOD:url?query` + for POST bodies:
  - **GraphQL**: normalized `query` string + sorted `variables` JSON (not headers, not `operationName` alone).
  - **Other JSON**: sorted-key body hash.
- **Similar match** (`useSimilarMatch`): path + method (+ optional required query params); **GraphQL still requires exact query + variables** for exact match.

## Common env vars

| Variable | Purpose |
|----------|---------|
| `MOCKIFYER_RECORD` | Record real responses |
| `MOCKIFYER_RECORD_NEW_AS_PASSTHROUGH` | New recordings get `alwaysUseRealApi` until activated in dashboard |
| `MOCKIFYER_REFRESH_PASSTHROUGH_RECORDINGS` | Overwrite passthrough recordings on each live API call |
| `MOCKIFYER_PATH` / `mockDataPath` | Mock data root |
| `MOCKIFYER_SCENARIO` | Active scenario |
| `MOCKIFYER_MODE` | RN: `on` \| `launch_client` \| `off` |
| `MOCKIFYER_DOMAIN_PATH_RULES_MODE` | Hybrid/disk: `allowlist` (default) \| `record_all` \| `off` |
| `MOCKIFYER_ACTIVATION_MODE` | `always` \| `client_id_header` \| `off` |
| `MOCKIFYER_USE_SIMILAR_MATCH` | Path-level fallback matching |
| `MOCKIFYER_DASHBOARD_AUTH_USER` + `MOCKIFYER_DASHBOARD_AUTH_PASSWORD` | Optional HTTP Basic Auth on dashboard |
| `MOCKIFYER_ECHO_TRACE_ID` | Echo `X-Mockifyer-Request-Id` on responses (default on; set `false` to disable) |
| `MOCKIFYER_AUTO_INBOUND_CORRELATION` | Node inbound hop capture on `setupMockifyer` (default on) |

Thrown/rejected HTTP errors are stamped with `error.mockifyerRequestId` (dashboard `/api/network-events/trace` lookup key). Express: `createMockifyerErrorHandler()`.

See [reference.md](reference.md) for dashboard API, Redis proxy, and PR build rules.

## Implementation rules

- **async/await**, explicit errors, TypeScript strict, interfaces over type aliases for objects.
- **DRY**: extract repeated logic; no drive-by refactors outside the task.
- **Git**: never commit/push unless the user asks.
- **Versions**: when code under `packages/<pkg>/` changes, bump that package’s `version` (and every other changed package) before PR — see `.cursor/rules/release-pr-build-check.mdc`.
- **Dashboard builds** (if touching `packages/mockifyer-dashboard`): run frontend + backend build before PR (same rule).
- **Linear issues**: project `Mockifyer`, labels `feature` + `backlog` unless overridden.

## Quick tasks

**Add / fix mock matching** → `packages/mockifyer-core/src/utils/mock-matcher.ts` + tests in `tests/mock-matcher.test.ts`.

**Axios / fetch interceptors** → `packages/mockifyer-axios` or `packages/mockifyer-fetch` `src/index.ts`.

**Dashboard list / similar GraphQL groups** → `packages/mockifyer-dashboard/src/routes/mocks.ts`, `mock-body-similarity.ts` in core.

**React Native** → [REACT_NATIVE.md](../../../REACT_NATIVE.md), Hybrid provider, Metro sync.

**Why two GraphQL mocks?** Different `query` documents → different keys even if `operationName` and `variables` match. Dashboard `?similarGroups=1` clusters near-duplicates for review only.

## Docs to read first

- [README.md](../../../README.md) — overview, env, scenarios
- [packages/mockifyer-dashboard/README.md](../../../packages/mockifyer-dashboard/README.md) — CLI, auth, embed
- [MULTI_CLIENT_ISOLATION.md](../../../MULTI_CLIENT_ISOLATION.md) — Redis lanes / proxy
- [reference.md](reference.md) — condensed deep reference
- **Trace sidecar (PR #333):** `response.mockifyerTrace` on axios/fetch — lookup ids without wrapping `response.data`. See [debugging-and-incidents.md](../../../docs/architecture/debugging-and-incidents.md).
- Inline response trace: `X-Mockifyer-Include-Trace: 1` → `{ data, mockifyerTrace }` (test/debug only; no Redis required for in-process hops). Opt-in is forwarded on outbound hops; nested downstream `mockifyerTrace` envelopes are unwrapped and merged into the parent buffer. Internal POSTs to dashboard `/api/proxy` are bypassed and never shown as hops.
