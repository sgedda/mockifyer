# Mockifyer — AI assistant guide

Use this document when integrating or debugging Mockifyer in this project: `setupMockifyer`, `mock-data`, scenarios, GraphQL matching, env vars, and API test fixtures.

Mockifyer intercepts HTTP (axios or fetch), looks up a JSON mock under `mock-data/<scenario>/`, and returns the stored response. In **record** mode it calls the real API and saves the response.

## Packages

| Package | Use |
|---------|-----|
| `@sgedda/mockifyer-core` | Types, `getCurrentDate`, providers, matching |
| `@sgedda/mockifyer-axios` | `setupMockifyer` for Axios |
| `@sgedda/mockifyer-fetch` | `setupMockifyer` for fetch / React Native |
| `@sgedda/mockifyer-dashboard` | Optional UI + `/api/*` for browsing mocks |

Install axios or fetch adapter plus core:

```bash
npm install @sgedda/mockifyer-core @sgedda/mockifyer-fetch
# or: @sgedda/mockifyer-axios
```

## Quick start

**Filesystem replay (local dev / CI):**

```typescript
import { initMockifyerForLocalFilesystem } from '@sgedda/mockifyer-fetch';

initMockifyerForLocalFilesystem({
  mockDataPath: './mock-data',
  recordMode: process.env.MOCKIFYER_RECORD === 'true',
});
```

**Full control:**

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: false,
  useSimilarMatch: true,
  dateManipulation: { fixedDate: '2024-01-01T00:00:00.000Z' },
});
```

**Dashboard + Redis proxy (team / remote mocks):**

```typescript
import { initMockifyerForDashboardProxy } from '@sgedda/mockifyer-fetch';

await initMockifyerForDashboardProxy({
  dashboardBaseUrl: 'http://localhost:3002',
  mockDataPath: './mock-data',
  clientId: process.env.MOCKIFYER_CLIENT_ID,
});
```

Axios: same preset names from `@sgedda/mockifyer-axios`.

## Core rules

- **Dates in tests**: use `getCurrentDate()` from the same package as `setupMockifyer`, not `new Date()`.
- **Mock data**: `mock-data/<scenario>/*.json` — one file per recorded request/response.
- **Scenarios**: folder under `mock-data/`; active scenario from `MOCKIFYER_SCENARIO`, config, or dashboard.
- **Matching key**: `METHOD:url?query` + for POST bodies:
  - **GraphQL**: normalized `query` + sorted `variables` (not headers, not `operationName` alone).
  - **Other JSON**: sorted-key body hash.
- **Similar match** (`useSimilarMatch`): fallback by path/method/query — GraphQL still needs exact query + variables for exact match.

## Common env vars

| Variable | Purpose |
|----------|---------|
| `MOCKIFYER_RECORD` | Record real responses to disk/Redis |
| `MOCKIFYER_PATH` | Mock data root (alias for `mockDataPath`) |
| `MOCKIFYER_SCENARIO` | Active scenario folder name |
| `MOCKIFYER_MODE` | React Native: `on` \| `launch_client` \| `off` |
| `MOCKIFYER_ACTIVATION_MODE` | `always` \| `client_id_header` \| `off` |
| `MOCKIFYER_USE_SIMILAR_MATCH` | Path-level fallback matching |
| `MOCKIFYER_RECORD_NEW_AS_PASSTHROUGH` | New recordings default to live API until activated |
| `MOCKIFYER_PROXY_RECORD_ON_MISS` | Client flag for dashboard proxy record-on-miss |

## Frequent tasks

**Why two GraphQL mocks for the "same" operation?** Different field selections in `query` → different keys even when `operationName` and `variables` match.

**Record then replay:** New recordings may set `alwaysUseRealApi: true` until unchecked in dashboard — use `MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API=false` to replay immediately.

**React Native:** use `@sgedda/mockifyer-fetch`, Hybrid provider, Metro sync — see package docs and [mockifyer.dev](https://mockifyer.dev).

**Dashboard:** `npx mockifyer-dashboard --path ./mock-data`

## More detail

See [reference.md](./reference.md) in this folder, or [mockifyer.dev/llms.txt](https://mockifyer.dev/llms.txt).
