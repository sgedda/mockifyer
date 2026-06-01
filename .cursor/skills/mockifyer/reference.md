# Mockifyer reference (for agents)

## setupMockifyer (axios / fetch)

```typescript
setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true, // or env MOCKIFYER_RECORD
  recordNewMocksAsPassthrough: true, // MOCKIFYER_RECORD_NEW_AS_PASSTHROUGH — new files get alwaysUseRealApi
  refreshPassthroughRecordings: true, // MOCKIFYER_REFRESH_PASSTHROUGH_RECORDINGS — update passthrough files in place
  useSimilarMatch: true,
  similarMatchRequiredParams: ['season', 'league'],
  similarMatchIgnoreAllQueryParams: true,
  activationMode: 'always', // | 'client_id_header' | 'off'
  dateManipulation: { fixedDate: '2024-01-01T00:00:00.000Z' },
  defaultScenario: 'default',
});
```

`client_id_header`: only intercept when `X-Mockifyer-Client-Id` is set (constant `MOCKIFYER_CLIENT_ID_HEADER` in core).

## GraphQL matching pitfalls

- Two requests with same `operationName` and `variables` but **different field selections** in `query` → **two mocks**.
- Headers (`authorization`, `jwt`, etc.) are **not** part of `generateRequestKey`.
- Whitespace in query is normalized before keying.

## Dashboard

**CLI**: `npx mockifyer-dashboard --path ./mock-data [--port 3002] [--base /dashboard]`

**Optional Basic Auth** (both required):

- Env: `MOCKIFYER_DASHBOARD_AUTH_USER`, `MOCKIFYER_DASHBOARD_AUTH_PASSWORD`
- Or embed: `createServer(publicDir, mockDataPath, { basicAuth: { username, password }, ... })`

Unauthenticated: `OPTIONS`, `GET`/`HEAD` `/api/health` only.

**Similar body groups** (listing UX, not runtime match):

- `GET /api/mocks?similarGroups=1&similarThreshold=0.88`
- Clusters GraphQL mocks: same URL + method + operation + variables, high token overlap on query text.

**Embed** under another Express app:

```typescript
import { createServer, getDashboardJsonBodyLimit } from '@sgedda/mockifyer-dashboard';

app.use(express.json({ limit: getDashboardJsonBodyLimit() })); // before mount if host parses JSON
app.use('/mockifyer', createServer(publicDir, mockDataPath, { provider: 'filesystem' }));
```

**Redis provider**: mocks keyed by request hash; duplicate API in UI disabled; use client lanes + `/api/proxy`.

**Network trace** (multi-service response chain):

- After calling an entry service, read **`X-Mockifyer-Request-Id`** from the response (`createMockifyerCorrelationMiddleware()` echoes it by default).
- `GET /api/network-events/trace?requestId=<that id>&scenario=default` — also matches virtual roots (id only appears as `parentRequestId` on child hops).
- Or `?eventId=<dashboard log row id>` when you only have the network tab id.
- `/api/proxy` JSON includes `requestId` / `parentRequestId` and sets the same response header.
- Returns `trace.hops[]` root-first with `request` / `response` body previews when **Bodies** capture is enabled.

## Scenario precedence (filesystem SDK)

1. `MOCKIFYER_SCENARIO`
2. `defaultScenario` / `scenarios.default` in config
3. `scenario-config.json` (per-client file when present)
4. `default` folder

## Redis dashboard proxy scenario

Per request: body `scenario` → `client_scenario:{clientId}` → Redis `active_scenario` → filesystem seed.

`MOCKIFYER_STRICT_LANE_SCENARIO`: with `clientId`, missing lane → upstream only (no mock replay/record).

## Tests

```bash
npm test -- --testPathPattern=mock-matcher
npm test -- --testPathPattern=mock-body-similarity
npm test -- --testPathPattern=dashboard-basic-auth
```

## PR build (dashboard)

```bash
npm --prefix packages/mockifyer-dashboard/frontend run build
npm --prefix packages/mockifyer-dashboard run build:backend
```

## File layout (filesystem mocks)

Often: `{host}/graphql/{operationName}/POST_{operationName}_{timestamp}.json` via `getMockFilePath` in core `file-naming.ts`.
