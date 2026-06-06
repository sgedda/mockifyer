# Mockifyer reference (for app projects)

## setupMockifyer options (axios / fetch)

```typescript
setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true,
  recordNewMocksAsPassthrough: true,
  refreshPassthroughRecordings: true,
  useSimilarMatch: true,
  similarMatchRequiredParams: ['season', 'league'],
  similarMatchIgnoreAllQueryParams: true,
  activationMode: 'always', // | 'client_id_header' | 'off'
  dateManipulation: { fixedDate: '2024-01-01T00:00:00.000Z' },
  defaultScenario: 'default',
  databaseProvider: { type: 'filesystem' }, // | memory | redis | hybrid | expo-filesystem
  proxy: {
    baseUrl: 'http://localhost:3002',
    scenario: 'default',
    recordOnMiss: true,
  },
  clientId: process.env.MOCKIFYER_CLIENT_ID,
});
```

`activationMode: 'client_id_header'` — only intercept when header `X-Mockifyer-Client-Id` is set.

## Presets

| Function | When |
|----------|------|
| `initMockifyerForLocalFilesystem` | JSON on disk, no dashboard |
| `initMockifyerForDashboardProxy` | HTTP via dashboard `/api/proxy` when Redis is healthy |
| `setupMockifyerForReactNative` | Expo / RN with `MOCKIFYER_MODE` |

`initMockifyerForDashboardProxy` probes `GET /api/health` — if Redis is down, falls back to filesystem mocks unless `skipDashboardRedisHealthCheck: true`.

## GraphQL matching pitfalls

- Same `operationName` + `variables` but **different field selections** in `query` → **two mocks**.
- Auth headers are **not** part of the match key.
- Query whitespace is normalized before keying.

## Dashboard

```bash
npx mockifyer-dashboard --path ./mock-data [--port 3002] [--base /dashboard]
```

Optional HTTP Basic Auth: `MOCKIFYER_DASHBOARD_AUTH_USER` + `MOCKIFYER_DASHBOARD_AUTH_PASSWORD`.

Embed in Express:

```typescript
import { createServer, getDashboardJsonBodyLimit } from '@sgedda/mockifyer-dashboard';

app.use(express.json({ limit: getDashboardJsonBodyLimit() }));
app.use('/mockifyer', createServer(publicDir, mockDataPath));
```

## Scenario precedence (filesystem)

1. `MOCKIFYER_SCENARIO`
2. `defaultScenario` in setup config
3. `scenario-config.json`
4. `default` folder

## Proxy record-on-miss

| `proxy.recordOnMiss` | Behavior |
|------------------------|----------|
| `true` | Force record on proxy miss |
| `false` | Never record on miss from this client |
| Omitted | Defer to dashboard per-scenario toggle; env `MOCKIFYER_PROXY_RECORD_ON_MISS` can set client default |

## Mock file layout

Typical path: `mock-data/<scenario>/<host>/graphql/<operationName>/POST_*.json`

Each file stores request metadata + response body used for replay.

## External docs

- [mockifyer.dev](https://mockifyer.dev) — getting started, playground
- [llms.txt](https://mockifyer.dev/llms.txt) — AI-oriented summary
- [GitHub](https://github.com/sgedda/mockifyer) — source, issues
