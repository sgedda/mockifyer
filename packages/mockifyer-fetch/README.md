# @sgedda/mockifyer-fetch

Record and replay fetch HTTP calls as JSON mocks for Node.js and React Native.

## Overview

`@sgedda/mockifyer-fetch` intercepts fetch requests (node-fetch, undici, React Native's native fetch) at the network layer, recording real API responses as JSON files and replaying them in tests.

**Features:**
- ✅ Selective recording by default (mark-and-capture, not capture-all)
- ✅ Scenario switching for different data states
- ✅ GraphQL query normalization and matching
- ✅ Date/time control for time-dependent tests
- ✅ **React Native and Expo support** (no service workers required)
- ✅ Works with existing fetch code

## Installation

```bash
npm install @sgedda/mockifyer-fetch
```

## Quick Start (Node.js)

### 1. Setup (before fetch calls)

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: false, // Set to true to record
  scenario: 'default',
});
```

### 2. Use fetch normally

```typescript
const response = await fetch('https://api.example.com/users');
const data = await response.json();
```

### 3. Record mocks

```bash
MOCKIFYER_RECORD=true npm test
```

Responses are saved to `./mock-data/default/` as JSON.

## React Native / Expo

For React Native setup, see the [React Native guide](https://mockifyer.dev/guides/react-native-without-msw).

```typescript
// App.tsx or index.js (before any HTTP calls)
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  scenario: 'default',
  mockifyerMode: 'launch_client', // Only activate when launched with scenario
});
```

Launch with a scenario:

```bash
# iOS
npx expo start --ios -- --scenario happy-path

# Android
npx expo start --android -- --scenario happy-path
```

## Environment Variables

- `MOCKIFYER_MODE=on|off|launch_client` — Enable/disable mocking
- `MOCKIFYER_RECORD=true|false` — Record new mocks
- `MOCKIFYER_PATH=./mock-data` — Mock storage path
- `MOCKIFYER_SCENARIO=scenario-name` — Active scenario

See the [Configuration Reference](https://mockifyer.dev/config-reference) for all options.

## Documentation

Full documentation at **[mockifyer.dev](https://mockifyer.dev)**:

- [Getting Started](https://mockifyer.dev/getting-started)
- [React Native Without MSW](https://mockifyer.dev/guides/react-native-without-msw)
- [E2E Tutorial](https://mockifyer.dev/e2e-tutorial)

## Related Packages

- **[@sgedda/mockifyer-core](https://www.npmjs.com/package/@sgedda/mockifyer-core)** — Core utilities (auto-installed as dependency)
- **[@sgedda/mockifyer-axios](https://www.npmjs.com/package/@sgedda/mockifyer-axios)** — For axios instead of fetch
- **[@sgedda/mockifyer-dashboard](https://www.npmjs.com/package/@sgedda/mockifyer-dashboard)** — Local UI and CLI for browsing mocks

## License

MIT

## Repository

[https://github.com/sgedda/mockifyer](https://github.com/sgedda/mockifyer)
