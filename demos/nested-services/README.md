# Nested Services Demo

Mockifyer demo showcasing nested/chained service calls with request tracing, offline replay, and scenario switching.

## Architecture

```
Gateway (BFF) - Promise.all() fan-out
    ├→ Weather API (parallel, 1st level)
    ├→ Places → Reviews (nested, 2nd level)  
    └→ Currency API (parallel, 1st level)
```

## Key Features

- **Fan-out topology**: Gateway calls multiple services in parallel
- **Nested calls**: Places service calls Reviews service (2nd level hop)
- **Request tracing**: `x-mockifyer-request-id` propagated across all hops
- **Offline replay**: All mocks recorded, no real network needed
- **Scenario switching**: 3 scenarios (default, empty-reviews, currency-error)
- **No API keys**: Local Express stubs simulate external services

## Setup

```bash
npm install
npx playwright install chromium  # For e2e tests
```

## Recording Fixtures

**IMPORTANT**: Must set `recordResponses: true` for full response bodies!

```javascript
setupMockifyer({
  recordMode: true,
  recordResponses: true,  // REQUIRED for full recording!
  mockDataPath: './mock-data',
  // ...
});
```

### Record from stubs

```bash
# Terminal 1: Start stubs
node stubs.js

# Terminal 2: Record
node record.js
```

### Verify recorded mocks

```bash
cat mock-data/default/localhost/weather/*.json | jq .response
# Should have: status: 200, data: {...}, no responsePending
```

## Testing

### Offline replay

```bash
node test-offline.js
```

### Network blocking proof

```bash
node test-offline-network-blocked.js
```

### All scenarios

```bash
node test-scenarios.js
```

### E2E tests

```bash
npm run test:e2e
```

## Running the Demo

### Gateway + Frontend

```bash
# Terminal 1
node gateway.js

# Terminal 2
npm run frontend

# Open http://localhost:5173
```

### With Dashboard

```bash
# Terminal 3
npm run dashboard

# Open http://localhost:3002
```

## Files

### Core
- `gateway.js` - BFF with fan-out topology
- `stubs.js` - Local Express stub services
- `index.html` + `main.js` - Frontend UI

### Recording
- `record.js` - Records default scenario (with recordResponses: true!)

### Testing
- `test-offline.js` - Basic offline replay
- `test-offline-network-blocked.js` - Network guard proof
- `test-scenarios.js` - 3-scenario switcher
- `e2e.spec.js` - Playwright e2e tests
- `playwright.config.js` - Test orchestration

### Mock Data (All Recorded)
- `mock-data/default/` - Default scenario
- `mock-data/empty-reviews/` - Empty reviews variation
- `mock-data/currency-error/` - Currency error variation

## Key Learning

**Mockifyer defaults to request-only stubs** (for dashboard proxy compatibility).

For local filesystem recording, you MUST set:
- `recordResponses: true` in config, OR
- `MOCKIFYER_RECORD_RESPONSES=true` env var

Without this, mocks will have `responsePending: true` and won't replay!
