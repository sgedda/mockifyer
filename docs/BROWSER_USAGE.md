# Browser & Expo Web Usage

## Overview

Mockifyer can run in browser environments (Vite, esbuild, Webpack) and Expo web builds using the **MemoryProvider** with preloaded fixtures. Node.js built-ins (`fs`, `path`, `crypto`) are lazy-loaded and won't break browser bundles.

## Quick Start

### 1. Install

```bash
npm install @sgedda/mockifyer-fetch @sgedda/mockifyer-core
```

### 2. Record Mocks (Node.js)

First, record your API calls in a Node.js environment:

```ts
// record.ts (run with ts-node or in Node.js)
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

const mockifyer = setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true,
  databaseProvider: {
    type: 'filesystem',
  },
});

// Make API calls - they'll be recorded to ./mock-data/default/
await mockifyer.get('https://api.frankfurter.dev/v1/latest');
```

### 3. Use Mocks in Browser

Import the recorded JSON fixtures and preload them into the MemoryProvider:

```ts
// app.ts (browser/Expo web)
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import ratesFixture from './mock-data/default/api.frankfurter.dev/v1/GET_latest.json';

const mockifyer = setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: false,
  failOnMissingMock: true, // Throw clear error if fixture is missing
  useGlobalFetch: true,    // Patch global fetch
  databaseProvider: {
    type: 'memory',
    options: {
      fixtures: [ratesFixture], // Preload from static JSON import
    },
  },
});

// Now fetch() calls will use the preloaded mock
const response = await fetch('https://api.frankfurter.dev/v1/latest');
console.log(await response.json());
```

## Dashboard Connection (Optional)

Connect your browser client to a running Mockifyer dashboard to:
- **Sync scenarios**: Automatically follow scenario changes from the dashboard
- **Report traffic**: See browser requests in the dashboard's Network view alongside backend hops
- **Client lanes**: Isolate browser sessions with unique client IDs

### Setup

1. Start the dashboard with CORS enabled:

```bash
# Allow all origins (development only)
MOCKIFYER_DASHBOARD_CORS=* npx mockifyer-dashboard --port 3002

# Or allow specific origins
MOCKIFYER_DASHBOARD_CORS=http://localhost:5174,http://localhost:3000 npx mockifyer-dashboard --port 3002
```

2. Configure the browser client:

```ts
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

const mockifyer = setupMockifyer({
  mockDataPath: './mock-data',
  databaseProvider: {
    type: 'memory',
    options: { fixtures: [...] }
  },
  dashboard: {
    dashboardBaseUrl: 'http://localhost:3002',
    clientId: 'web-app', // Optional: for client lane isolation
    enableScenarioSync: true, // Default true
    enableNetworkEvents: true, // Default true
    pollIntervalMs: 2000, // Default 2000ms
  }
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dashboardBaseUrl` | `string` | required | Dashboard URL (e.g. `http://localhost:3002`) |
| `clientId` | `string` | undefined | Client lane ID for multi-client isolation |
| `auth` | `{ user, password }` | undefined | HTTP Basic Auth credentials |
| `enableScenarioSync` | `boolean` | `true` | Poll dashboard for scenario changes |
| `enableNetworkEvents` | `boolean` | `true` | Report traffic to dashboard Network view |
| `pollIntervalMs` | `number` | `2000` | Scenario poll interval (ms) |

### CORS Configuration

The dashboard must allow browser origins via the `MOCKIFYER_DASHBOARD_CORS` environment variable:

- `off` or `false`: CORS disabled (dashboard not accessible from browsers)
- `*`, `on`, or `true`: Allow all origins (development only)
- `http://localhost:5174,http://example.com`: Comma-separated allowed origins

**Auth with CORS**: When HTTP Basic Auth is enabled (`MOCKIFYER_DASHBOARD_AUTH_USER`), specific origins must be listed (not `*`) and the dashboard will set `Access-Control-Allow-Credentials: true`.

### Client Lanes

Use `clientId` to isolate browser sessions when the dashboard runs with `--provider redis` or `--provider sqlite`:

```ts
const mockifyer = setupMockifyer({
  // ...
  dashboard: {
    dashboardBaseUrl: 'http://localhost:3002',
    clientId: `web-${sessionId}`, // Unique per browser session
  }
});
```

Each client gets its own scenario lane in the dashboard Settings panel. Switch scenarios per-client without affecting other sessions.

### Example: Vite + Dashboard

```ts
// src/mockifyer-setup.ts
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import ratesFixture from '../mock-data/default/api.example.com/GET_rates.json';

const mockifyer = setupMockifyer({
  mockDataPath: './mock-data',
  databaseProvider: {
    type: 'memory',
    options: { fixtures: [ratesFixture] }
  },
  useGlobalFetch: true,
  dashboard: {
    dashboardBaseUrl: import.meta.env.VITE_MOCKIFYER_DASHBOARD_URL || 'http://localhost:3002',
    clientId: `web-${crypto.randomUUID()}`,
  }
});

export default mockifyer;
```

## Recorded JSON Format

The MemoryProvider accepts the same format the FilesystemProvider writes:

```json
{
  "request": {
    "method": "GET",
    "url": "https://api.frankfurter.dev/v1/latest",
    "headers": {},
    "queryParams": {}
  },
  "response": {
    "status": 200,
    "headers": {
      "content-type": "application/json"
    },
    "data": {
      "amount": 1.0,
      "base": "USD",
      "date": "2024-01-15",
      "rates": {
        "EUR": 0.92,
        "GBP": 0.79
      }
    }
  },
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

## Seeding After Construction

You can also seed fixtures after creating the provider:

```ts
import { MemoryProvider } from '@sgedda/mockifyer-core';

const provider = new MemoryProvider({ options: {} });

// Load fixtures from multiple sources
provider.seed([fixture1, fixture2]);
provider.seed([fixture3]); // Cumulative

const mockifyer = setupMockifyer({
  mockDataPath: './mock-data',
  databaseProvider: {
    type: 'memory',
    options: {},
  },
});
```

## Error Handling in Replay Mode

When `failOnMissingMock: true` and `recordMode: false`, missing mocks throw a clear error:

```
[Mockifyer] No mock found for GET https://api.example.com/users/42
Scenario: default
Request key: GET:https://api.example.com/users/42

In replay mode with failOnMissingMock=true, all requests must have recorded mocks.
To fix:
  1. Record this request: set recordMode: true
  2. Or preload fixture: databaseProvider: { type: 'memory', options: { fixtures: [...] } }
  3. Or allow passthrough: set failOnMissingMock: false
```

## Expo Web Example

```ts
// App.tsx (Expo SDK ~58, RN 0.88, Expo Router, Metro web)
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import frankfurterRates from './fixtures/api.frankfurter.dev/v1/GET_latest.json';

const mockifyer = setupMockifyer({
  mockDataPath: './fixtures',
  recordMode: false,
  failOnMissingMock: true,
  useGlobalFetch: true,
  databaseProvider: {
    type: 'memory',
    options: {
      fixtures: [frankfurterRates],
    },
  },
});

export default function App() {
  const [rates, setRates] = React.useState(null);

  React.useEffect(() => {
    fetch('https://api.frankfurter.dev/v1/latest')
      .then((r) => r.json())
      .then(setRates);
  }, []);

  return <Text>{JSON.stringify(rates, null, 2)}</Text>;
}
```

## Bundler Configuration

### Vite

Vite respects the `browser` export condition by default. No extra config needed.

### esbuild

```js
esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'browser',
  conditions: ['browser', 'module', 'import'],
  mainFields: ['browser', 'module', 'main'],
  ...
});
```

### Webpack 5

```js
module.exports = {
  resolve: {
    conditionNames: ['browser', 'module', 'import'],
    mainFields: ['browser', 'module', 'main'],
  },
};
```

## Limitations

- **Only MemoryProvider** is supported in browsers. `filesystem`, `redis`, and `sqlite` require Node.js.
- **Fixtures must be static imports** or preloaded JSON. No dynamic `fs.readFileSync()` in the browser.
- **Recording requires Node.js**. Record in development/tests, then bundle the JSON for browser replay.

## Troubleshooting

### Bundler fails with "Cannot resolve 'fs'"

Make sure your bundler uses the `browser` export condition. Check:
- Vite: works by default
- esbuild: set `conditions: ['browser']` and `mainFields: ['browser', 'module', 'main']`
- Webpack: set `resolve.conditionNames` and `resolve.mainFields`

### "No mock found" error even with fixtures

Verify:
1. Request URL/method matches exactly (check `requestKey` in error)
2. POST requests: body hash must match (include the exact `data` from recording)
3. Fixture was preloaded: `console.log(provider.size())` should be > 0

### Fixture doesn't load

Check:
- JSON is valid (`JSON.parse(fixture)` works)
- `request` field exists with `method`, `url`, `headers`
- Import path is correct (static import, not dynamic)

## Next Steps

- See [examples/browser-demo](../examples/browser-demo) for a complete working demo
- Read [MULTI_CLIENT_ISOLATION.md](../MULTI_CLIENT_ISOLATION.md) for Redis proxy scenarios
- Check [README.md](../README.md) for Node.js filesystem usage
