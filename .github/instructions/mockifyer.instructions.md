---
description: Mockifyer monorepo — HTTP mocking, scenarios, dashboard, GraphQL keys, React Native
applyTo: >-
  packages/**,
  mockifyer-web/**,
  tests/**,
  example-projects/**,
  mock-data/**
---

# Mockifyer development instructions

Apply when working on Mockifyer libraries, dashboard, mocks, or examples.

## Architecture

Mockifyer intercepts HTTP (axios or fetch), looks up a JSON mock under `mock-data/<scenario>/`, and returns the stored response. In **record** mode it calls the real API and saves the response. Matching is deterministic via `generateRequestKey` in `packages/mockifyer-core/src/utils/mock-matcher.ts`.

## Request keys (critical)

- **URL**: lowercased method + URL + sorted query string.
- **GraphQL POST**: adds `|body:gql:{normalizedQuery}:vars:{sortedVariablesJson}`.
- **Not included**: auth headers, JWT, `operationName` (filename may use it; key does not).
- **Similar match** (`useSimilarMatch`): fallback by path/method/query rules — does **not** relax GraphQL exact query+variables requirement for exact match.

If the user sees duplicate GraphQL mocks for the “same” operation, compare **full query documents**, not only `variables`.

## Packages

| Path | Responsibility |
|------|----------------|
| `packages/mockifyer-core` | Types, providers, `generateRequestKey`, scenarios, dates, `buildSimilarMockGroups` |
| `packages/mockifyer-axios` | Axios interceptors, `setupMockifyer` |
| `packages/mockifyer-fetch` | fetch + RN, Metro sync middleware |
| `packages/mockifyer-dashboard` | Express `/api/*`, React UI, Redis store, optional Basic Auth |
| `mockifyer-web` | Demo app |

## Dashboard

- Start: `npm --prefix packages/mockifyer-dashboard run dev` or `npx mockifyer-dashboard`
- Optional auth: `MOCKIFYER_DASHBOARD_AUTH_USER` + `MOCKIFYER_DASHBOARD_AUTH_PASSWORD` (HTTP Basic; health GET/HEAD and OPTIONS exempt)
- Near-duplicate GraphQL listing: `GET /api/mocks?similarGroups=1` (analysis only)
- Embed: `createServer` from `@sgedda/mockifyer-dashboard`; set host `express.json` limit via `getDashboardJsonBodyLimit()` when mounting under another app

## React Native

Read `REACT_NATIVE.md`: `MOCKIFYER_MODE`, Hybrid provider, device sync, `setupMockifyerForReactNative`. Use `@sgedda/mockifyer-fetch`, not axios, for RN.

## Environment (frequent)

- `MOCKIFYER_RECORD` — record mode
- `MOCKIFYER_SCENARIO` — active scenario folder
- `MOCKIFYER_ACTIVATION_MODE` — `always` | `client_id_header` | `off`
- `MOCKIFYER_USE_SIMILAR_MATCH` — path-level similar matching
- `MOCKIFYER_STRICT_LANE_SCENARIO` — Redis dashboard proxy lane requirement

## Tests & builds

```bash
npm test -- --testPathPattern=mock-matcher
npm --prefix packages/mockifyer-core run build
```

Dashboard changes:

```bash
npm --prefix packages/mockifyer-dashboard/frontend run build
npm --prefix packages/mockifyer-dashboard run build:backend
```

## Repo rules

- Follow existing patterns in the file being edited
- No unrelated refactors; no new markdown docs unless asked
- Git: no commit/push without explicit user request
- Linear issues: project **Mockifyer**, labels **feature** and **backlog**

## More detail

See `.cursor/skills/mockifyer/reference.md` and root `README.md`.
