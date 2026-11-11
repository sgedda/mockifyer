# @sgedda/mockifyer-axios

Record and replay axios HTTP calls as JSON mocks for deterministic Node.js testing.

## Overview

`@sgedda/mockifyer-axios` intercepts axios requests at the network layer, recording real API responses as JSON files and replaying them in tests. No code changes required — just configure and run.

**Features:**
- ✅ Selective recording by default (mark-and-capture, not capture-all)
- ✅ Scenario switching for different data states
- ✅ GraphQL query normalization and matching
- ✅ Date/time control for time-dependent tests
- ✅ Works with existing axios code

## Installation

```bash
npm install @sgedda/mockifyer-axios
```

## Quick Start

### 1. Setup (before axios import)

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: false, // Set to true to record
  scenario: 'default',
});
```

### 2. Use axios normally

```typescript
import axios from 'axios';

const response = await axios.get('https://api.example.com/users');
```

### 3. Record mocks

```bash
MOCKIFYER_RECORD=true npm test
```

Responses are saved to `./mock-data/default/` as JSON.

## Environment Variables

- `MOCKIFYER_MODE=on|off` — Enable/disable mocking
- `MOCKIFYER_RECORD=true|false` — Record new mocks
- `MOCKIFYER_PATH=./mock-data` — Mock storage path
- `MOCKIFYER_SCENARIO=scenario-name` — Active scenario

See the [Configuration Reference](https://mockifyer.dev/config-reference) for all options.

## Documentation

Full documentation at **[mockifyer.dev](https://mockifyer.dev)**:

- [Getting Started](https://mockifyer.dev/getting-started)
- [E2E Tutorial](https://mockifyer.dev/e2e-tutorial)
- [Comparisons (vs MSW, Nock)](https://mockifyer.dev/comparisons)

## Related Packages

- **[@sgedda/mockifyer-core](https://www.npmjs.com/package/@sgedda/mockifyer-core)** — Core utilities (auto-installed as dependency)
- **[@sgedda/mockifyer-fetch](https://www.npmjs.com/package/@sgedda/mockifyer-fetch)** — For fetch/undici instead of axios
- **[@sgedda/mockifyer-dashboard](https://www.npmjs.com/package/@sgedda/mockifyer-dashboard)** — Local UI and CLI for browsing mocks

## License

MIT

## Repository

[https://github.com/sgedda/mockifyer](https://github.com/sgedda/mockifyer)
