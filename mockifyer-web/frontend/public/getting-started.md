# Getting started with Mockifyer

Interactive guide: https://mockifyer.dev/getting-started

## Packages

Install scoped packages — not the private monorepo root:

```bash
npm install @sgedda/mockifyer-core @sgedda/mockifyer-axios axios
# or
npm install @sgedda/mockifyer-core @sgedda/mockifyer-fetch
```

Optional: `@sgedda/mockifyer-dashboard`, `@sgedda/mockifyer-mcp`, `@sgedda/mockifyer-test-helper`

## Node.js (axios)

Call `setupMockifyer` **before** importing axios. Skip init in production (`NODE_ENV=production`).

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: process.env.MOCKIFYER_RECORD === 'true',
  useGlobalAxios: true,
});

import axios from 'axios';
```

## Node.js (fetch)

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: process.env.MOCKIFYER_RECORD === 'true',
  useGlobalFetch: true,
});
```

## Record vs replay

- `MOCKIFYER_RECORD=true` — call live APIs, save JSON under `mock-data/<scenario>/`
- `MOCKIFYER_RECORD=false` — return saved mocks for matching requests

## React Native

Use `@sgedda/mockifyer-fetch` with `setupMockifyerForReactNative`. Gate startup with:

- `MOCKIFYER_MODE=on` — always patch fetch when helper runs
- `MOCKIFYER_MODE=launch_client` — Maestro / launch-arg lane only
- `MOCKIFYER_MODE=off` — production store builds

## Multi-service (Node)

```typescript
setupMockifyer({
  mockDataPath: './mock-data',
  activationMode: 'client_id_header',
});

// Real API
await fetch('https://api.example.com/health');

// Mocked when header present
await fetch('https://api.example.com/orders', {
  headers: { 'X-Mockifyer-Client-Id': 'lane-1' },
});
```

## Dashboard & MCP

```bash
npx @sgedda/mockifyer-dashboard --path ./mock-data
```

With Redis: `--provider redis --redis-url redis://127.0.0.1:6379`

`@sgedda/mockifyer-mcp` connects Cursor/Claude to the dashboard (`mockifyer_get_mock_ai_context`, search, field overrides).

## Links

- [Config reference](https://mockifyer.dev/config-reference.md)
- [GitHub](https://github.com/sgedda/mockifyer)
