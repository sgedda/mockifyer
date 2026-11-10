# Mockifyer: Nested Services Demo

**Fan-out topology with multi-level API calls and request tracing**

## Topology

This demo shows a realistic microservices architecture:

```
Frontend
    ↓
Gateway (BFF)
    ├─→ Weather API (1st level)
    ├─→ Places API → Reviews API (2nd level - nested call!)
    └─→ Currency API (1st level)
```

All requests correlated with `x-mockifyer-request-id` for full tracing.

## Quick Start

```bash
npm install
npm run dev
```

This starts:
- **Frontend**: http://localhost:5173
- **Gateway**: http://localhost:3001
- **Dashboard**: http://localhost:3002

## What's Different from DevXTools Demo

### DevXTools' Mockifyer Demo
- Single API call
- No nested services
- No request tracing
- No dashboard integration

### This Demo
- ✅ **Fan-out topology**: Gateway calls 3 services in parallel
- ✅ **Nested calls**: Places service calls Reviews (2nd level hop)
- ✅ **Request tracing**: All 4 API calls correlated by request ID
- ✅ **Live dashboard**: Real Mockifyer dashboard showing trace
- ✅ **3 scenarios**: default, empty-reviews, currency-error
- ✅ **Date freezing**: Fixed date for deterministic tests

## Features

### 1. Fan-Out Topology
The gateway makes 3 parallel calls:
- Weather API (simple 1st level)
- Places API → Reviews API (nested 2nd level)
- Currency API (simple 1st level)

### 2. Request Correlation
Every call includes `x-mockifyer-request-id`, so the dashboard shows:
- Complete call graph
- All 4 API calls in one trace
- Request/response for each hop

### 3. Scenarios
Three scenarios demonstrate different states:
- **default**: All services return data
- **empty-reviews**: Reviews API returns empty array
- **currency-error**: Currency API returns 503 error

### 4. Date Freezing
All mocks use fixed date `2026-11-10T12:00:00.000Z` for deterministic testing.

## Project Structure

```
demos/nested-services/
├── gateway.js              # Express BFF with Mockifyer
├── index.html              # Frontend UI
├── main.js                 # Frontend logic
├── record.js               # Script to record mocks
├── test-offline.js         # Offline replay test
├── package.json            # Dependencies
├── .stackblitzrc           # StackBlitz config
└── mock-data/              # Pre-recorded fixtures
    ├── default/            # Happy path
    ├── empty-reviews/      # Empty reviews scenario
    └── currency-error/     # Currency error scenario
```

## How It Works

### Recording (Development)
```bash
npm run record
```
Calls real APIs and saves responses to `mock-data/default/`.

### Replay (Demo / Testing)
```bash
npm run dev
```
Loads mocks from disk. No network calls (100% offline).

### Switching Scenarios
The dashboard API or frontend dropdown changes the active scenario.
Mockifyer loads mocks from `mock-data/{scenario}/`.

### Request Correlation
Each request gets a `x-mockifyer-request-id` that propagates through:
- Frontend → Gateway
- Gateway → Weather, Places, Currency
- Places → Reviews (2nd level)

The dashboard traces all 4 calls.

## Testing

### Offline Test
```bash
node test-offline.js
```

This verifies mocks replay without network.

### Network Blocking Test
```bash
# Linux
unshare -rn node test-offline.js

# Verifies true offline capability
```

## Known Issues

1. **Mock matching**: The URL parameter handling for API keys may need adjustment
2. **Dashboard**: Requires `npm install` in the dashboard package first
3. **Concurrency**: `npm run dev` starts 3 processes - may need manual starts

## Requirements

- Node.js 20+
- No API keys needed (uses pre-recorded mocks)
- No network required (100% offline)

## Packages

- `@sgedda/mockifyer-core@^1.10.181`
- `@sgedda/mockifyer-fetch@^1.8.100`
- `@sgedda/mockifyer-dashboard@^1.5.93`

## Next Steps

1. Fix mock matching for API keys in URLs
2. Add Playwright e2e test
3. Test in actual StackBlitz WebContainer
4. Create screenshots/video walkthrough
