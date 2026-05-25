# Mockifyer overview

Mockifyer records and replays HTTP API calls made with **axios** or **fetch** as JSON mock files in your repository.

- **Site:** https://mockifyer.dev
- **GitHub:** https://github.com/sgedda/mockifyer

## Published packages (current)

| Package | Version | Role |
|---------|---------|------|
| @sgedda/mockifyer-core | 1.8.37 | Types, matching, scenarios, dates, activation, AI context |
| @sgedda/mockifyer-axios | 1.8.21 | Axios setupMockifyer |
| @sgedda/mockifyer-fetch | 1.8.31 | fetch / React Native / dashboard proxy |
| @sgedda/mockifyer-dashboard | 1.4.50 | CLI + UI, Redis proxy, client lanes |
| @sgedda/mockifyer-mcp | 0.1.0 | MCP tools for Cursor / Claude |
| @sgedda/mockifyer-test-helper | 1.8.9 | Test utilities |

## Capabilities

- Record & replay axios/fetch as searchable JSON
- GraphQL matching (normalized query + variables)
- Scenarios under `mock-data/<scenario>/`
- Date manipulation via `getCurrentDate()`
- Activation modes: `always`, `client_id_header`, `off`
- Client lanes (`MOCKIFYER_CLIENT_ID`) + dashboard Redis proxy
- Passthrough recordings until activated in dashboard
- Request correlation headers (`x-mockifyer-request-id`)
- React Native: `MOCKIFYER_MODE` (`on` | `launch_client` | `off`)

## Quick start (axios)

```bash
npm install @sgedda/mockifyer-core @sgedda/mockifyer-axios axios
```

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: process.env.MOCKIFYER_RECORD === 'true',
});

import axios from 'axios';
```

## More docs

- [Getting started](https://mockifyer.dev/getting-started.md)
- [Configuration reference](https://mockifyer.dev/config-reference.md)
- [llms.txt](https://mockifyer.dev/llms.txt)
