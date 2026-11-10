# Mockifyer Interactive Demos

These demos are designed to run in **StackBlitz WebContainers** — a browser-based Node.js runtime.

## Available Demos

### 1. `record-replay-basics/`
**Record, replay, scenarios, and date freezing**

Shows the core Mockifyer workflow:
- Record real API responses from `demo.devxtools.dev`
- Replay them offline (no network needed)
- Switch scenarios (empty list, error states)
- Freeze dates for time-dependent tests

[**Run in StackBlitz →**](https://stackblitz.com/github/sgedda/mockifyer/tree/main/demos/record-replay-basics)

### 2. `mock-drift-detection/`
**Detect when your mocks drift from the real API**

Demonstrates drift detection:
- Compare old vs new API responses
- Re-record when APIs change
- Git diff to see what changed

[**Run in StackBlitz →**](https://stackblitz.com/github/sgedda/mockifyer/tree/main/demos/mock-drift-detection)

## WebContainer Limitations

These demos run in **StackBlitz WebContainers**, which have important limitations:

### ✅ What Works
- Pure JavaScript packages (`@sgedda/mockifyer-fetch`, `@sgedda/mockifyer-axios`, `@sgedda/mockifyer-core`)
- Node.js `fetch` and `axios` HTTP clients
- Vitest test runner
- File system access (reading/writing mock files)

### ❌ What Doesn't Work
- **Native Node.js addons** (C++ bindings like `better-sqlite3`, standard SQLite)
- **React Native** (requires native iOS/Android toolchain)
- **Redis** (native server binary)
- **Docker** (not available in browser)
- **mockifyer-dashboard** (uses `better-sqlite3` native addon)

## Running Locally

To run any demo locally:

```bash
cd demos/<demo-name>
npm install
npm test           # Run tests
npm run record     # Record new mocks (requires internet)
```

## Demo Structure

Each demo follows this pattern:

```
demo-name/
├── package.json          # Dependencies and scripts
├── .stackblitzrc         # StackBlitz config (startCommand)
├── README.md             # What the demo shows
├── record.js             # Recording script (calls real API)
├── *.test.js             # Tests (replay from mock-data/)
└── mock-data/            # Recorded responses
    ├── default/          # Default scenario
    ├── <scenario-2>/     # Alternative scenario
    └── <scenario-3>/     # Another scenario
```

## Contributing

To add a new demo:

1. Create a new folder: `demos/<demo-name>/`
2. Add the standard files: `package.json`, `.stackblitzrc`, `README.md`, test files
3. Include pre-recorded mock data so the demo works immediately
4. Keep dependencies minimal (WebContainer compatible only)
5. Add the demo to this README

## Questions?

See the [main Mockifyer docs](https://mockifyer.dev) or open an [issue](https://github.com/sgedda/mockifyer/issues).
