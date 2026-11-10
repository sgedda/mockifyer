# Mockifyer: Nested Services Demo

**Live demo showing multi-level API call tracing, scenario switching, and the Mockifyer dashboard**

This demo demonstrates Mockifyer's power with a realistic microservices architecture:
- A **BFF/Gateway** that orchestrates calls to 3 downstream services
- **Request tracing** with `x-mockifyer-request-id` that correlates the entire chain
- **Live dashboard** showing the complete trace with all API hops
- **Scenario switching** to test different states (happy path, empty data, errors)
- **Date freezing** for consistent test data
- Pre-recorded fixtures for **100% offline operation**

## 🚀 60-Second Guided Tour

### 1. Start Everything (5 seconds)

```bash
npm install
npm run dev
```

This starts:
- **Frontend**: http://localhost:5173
- **Gateway**: http://localhost:3001
- **Dashboard**: http://localhost:3002

### 2. Make a Request (10 seconds)

Open http://localhost:5173 and click **"Get Trip Info"** (or it auto-fetches on load).

Watch the response appear with:
- Weather data (temperature, conditions, humidity)
- Location info (country, region, population)
- Currency exchange rate
- **Request trace** showing 3 API hops

### 3. See the Trace in the Dashboard (15 seconds)

Click **"Open Dashboard"** or go to http://localhost:3002

Navigate to **Network Events** to see:
- The complete request chain
- All 3 downstream API calls correlated by request ID
- Each request can be copied as a curl command
- Response times, status codes, headers

### 4. Switch Scenarios (15 seconds)

Back on the frontend (http://localhost:5173):
- Select **"Empty Weather"** from the dropdown
- Click **"Switch Scenario"**
- Watch the UI update to show a weather API error

Try **"Currency Service Error"** to see error handling.

### 5. Edit a Mock (15 seconds)

In the Dashboard:
1. Go to **Mocks** tab
2. Find the weather API mock
3. Click to open the editor
4. Change the temperature value
5. Save
6. Go back to the frontend and fetch again — see your edit!

## What Makes This Better Than DevXTools' Demo?

### DevXTools' Mockifyer Demo
- ✅ Simple record/replay
- ✅ Single API call (`/tasks/1`)
- ✅ Basic scenario (default only)
- ❌ No nested services
- ❌ No request tracing
- ❌ No dashboard integration
- ❌ No visualization of mock chain

### This Demo
- ✅ **Nested services**: Gateway → Weather → Places → Currency
- ✅ **Request tracing**: Every hop correlated with `x-mockifyer-request-id`
- ✅ **Live dashboard**: Full trace visualization with all hops
- ✅ **Multiple scenarios**: Default, empty weather, currency error
- ✅ **Interactive UI**: Beautiful frontend showing the power
- ✅ **Guided tour**: 60-second walkthrough to understand everything
- ✅ **100% offline**: All fixtures pre-recorded

## Architecture

```
Frontend (Vite)
    ↓
Gateway Service (Express + Mockifyer)
    ├─→ Weather API (api.openweathermap.org)
    ├─→ Places API (restcountries.com)
    └─→ Currency API (api.frankfurter.dev)
```

Each service call is:
1. **Recorded** with all headers, body, and response
2. **Traced** with a shared request ID
3. **Replayable** from JSON fixtures
4. **Switchable** via scenarios
5. **Visible** in the dashboard with complete trace

## Key Features Demonstrated

### 1. Nested API Calls
The gateway makes 3 sequential downstream calls:
- First: Weather API (gets country code)
- Second: Places API (gets currency code)
- Third: Currency API (gets exchange rate)

Each call passes `x-mockifyer-request-id` to correlate the entire chain.

### 2. Request Tracing
All calls in the chain share the same request ID, so the dashboard shows:
- The complete call graph
- Request/response for each hop
- Timing information
- Headers and body for debugging

### 3. Scenario Switching
Three scenarios demonstrate different states:
- **default**: Happy path with all data
- **empty-weather**: Weather API returns 404
- **currency-error**: Currency API returns 503

Switch scenarios from the UI or the dashboard.

### 4. Date Freezing
All mocks are recorded with a fixed date (`2026-11-10T12:00:00.000Z`), so:
- Tests are deterministic
- No time-based flakes
- Consistent timestamps across replays

### 5. Dashboard Integration
The dashboard runs alongside the demo, showing:
- Live mock management
- Request trace visualization
- Scenario controls
- Mock editing

## Project Structure

```
demos/nested-services/
├── index.html           # Frontend UI
├── main.js              # Frontend logic
├── gateway.js           # BFF/Gateway service
├── record.js            # Script to record new mocks
├── package.json         # Dependencies and scripts
├── .stackblitzrc        # StackBlitz configuration
└── mock-data/           # Pre-recorded fixtures
    ├── default/         # Happy path scenario
    ├── empty-weather/   # Weather API error scenario
    └── currency-error/  # Currency API error scenario
```

## How It Works

### Recording (Development)
```bash
npm run record
```
Makes real API calls and saves responses to `mock-data/default/`.

### Replay (Testing / Demo)
```bash
npm run dev
```
Loads mocks from disk. No network calls—100% offline.

### Switching Scenarios
The dashboard API (`PUT /api/scenario-config/active-scenario`) changes which scenario is active. Mockifyer loads mocks from `mock-data/{scenario}/` based on this setting.

### Request Correlation
Each request generates a unique `x-mockifyer-request-id` header that propagates through all downstream calls, allowing the dashboard to show the complete trace.

## Testing

Run tests to verify the demo:

```bash
npm test
```

Tests check:
- Gateway responds with trip info
- All 3 downstream services are called
- Request tracing works
- Scenarios can be switched

## Tips for Exploring

1. **Check the Network tab**: See that no real HTTP calls are made
2. **Edit mock files**: Change values in `mock-data/default/` and see updates
3. **Add new scenarios**: Create a new folder under `mock-data/` and switch to it
4. **View curl commands**: Dashboard shows curl for each request
5. **Try offline**: Disconnect network and verify it still works

## What to Look For

- **In the frontend**: The trace flow showing all 3 API hops
- **In the dashboard**: The Network Events tab with complete request graph
- **In mock files**: JSON files with full request/response pairs
- **In the console**: Gateway logs showing each downstream call
- **In the UI**: Scenario switching immediately affects responses

## Requirements

- Node.js 20+
- No API keys needed (uses pre-recorded mocks)
- No network required (100% offline)

## Packages Used

- `@sgedda/mockifyer-core`: Core mocking engine with filesystem provider
- `@sgedda/mockifyer-fetch`: Fetch adapter for intercepting HTTP calls
- `@sgedda/mockifyer-dashboard`: Live dashboard for mock management
- `express`: Gateway service
- `vite`: Frontend dev server
- `vitest`: Testing

## Next Steps

After exploring this demo:
1. Check out the [E2E Tutorial](https://mockifyer.dev/e2e-tutorial) for a full-stack example
2. Read the [Getting Started guide](https://mockifyer.dev/getting-started)
3. See the [WanderWeird demo app](https://github.com/sgedda/mockifyer/tree/main/example-projects/wanderweird-travel) for production-ready examples
