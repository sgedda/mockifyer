# Drift Detection Live Demo

A reproducible demonstration of Mockifyer's drift detection, showing how to detect, investigate, and resolve API contract changes.

## What This Demo Shows

This demo simulates a complete drift detection workflow using **a single endpoint** to make the story clear:

1. **Initial state**: Drift check against v1 API → `GET /api/trips` passes ✓
2. **API changes**: The **same endpoint** (`GET /api/trips`) switches to v2 schema
3. **Drift detected**: Check shows breaking drift on `/api/trips`
4. **Resolution**: Accept live v2 response for `/api/trips`
5. **Verification**: Re-run check → `/api/trips` in sync with v2 ✓

**Key insight**: The video shows drift detection for the **same URL** with **changed response data**, not two different API calls.

## Breaking Changes (v1 → v2)

### Dashboard Video Demo: `GET /api/trips`

The video focuses on one endpoint with minimal, readable changes:

| Change | v1 | v2 | Severity |
|--------|----|----|----------|
| Field removed | `"departureDate": "2026-12-01"` | _(removed)_ | Breaking |
| Field added | _(none)_ | `"departsAt": "2026-12-01"` | Breaking |
| Type changed | `"passengers": 2` | `"passengers": "2"` | Breaking |

**Volatile fields** (ignored via `mockifyer.drift.json`):
- `trips[].id`, `timestamp`

### CLI Demo: `GET /api/booking/:id` (Additional Example)

The CLI demo also includes a booking endpoint with warning-only drift for demonstration purposes. See `cli-demo.sh` for the full workflow.

## Quick Start - CLI Demo

### Prerequisites

```bash
# From repo root, ensure packages are built
sh packages/build-all.sh

cd demos/drift-live
npm install
```

### Run the CLI Demo

```bash
npm run cli-demo
```

This will:
1. Start backend in v1 mode
2. Run drift check → pass ✓
3. Switch to v2
4. Run drift check → fail with breaking drift ✗
5. Accept drift for `/api/trips`
6. Run drift check again → pass ✓

**Output**: Terminal output showing the full workflow with color-coded results.

## Manual Testing

Test individual steps:

```bash
# Terminal 1: Start backend v1
npm run backend:v1

# Terminal 2: Run drift check
npx mockifyer-drift-check --mock-data-path ./mock-data

# Switch backend (in Terminal 1)
# Stop with Ctrl+C, then:
npm run backend:v2

# Terminal 2: Check again (should show drift)
npx mockifyer-drift-check --mock-data-path ./mock-data

# Accept drift
npx mockifyer-drift-check --accept "GET /api/trips" --mock-data-path ./mock-data

# Verify
npx mockifyer-drift-check --mock-data-path ./mock-data
```

## File Structure

```
demos/drift-live/
├── backend.js                           # Express server (v1/v2 modes)
├── cli-demo.sh                          # Automated CLI workflow
├── demo.spec.ts                         # Playwright dashboard demo (trips only)
├── playwright.config.ts                 # Playwright configuration
├── mockifyer.drift.json                 # Drift check configuration
├── package.json                         # Dependencies and scripts
├── drift-workflow-demo.mp4              # Recorded dashboard video (806KB)
├── drift-workflow-demo.gif              # Recorded dashboard GIF (1.8MB)
├── mock-data/
│   └── drift-watch/                     # Recorded mocks (v1 baseline)
│       ├── domain-path-rules.json
│       └── localhost:4100/
│           └── api/
│               └── trips/
│                   └── GET_2026-11-10_12-00-00.json  # v1: departureDate, passengers as number
└── README.md                            # This file
```

**Note**: The booking endpoint mock is used by `cli-demo.sh` but not in the Playwright video to keep the story focused on one endpoint.

## Configuration

**`mockifyer.drift.json`:**

```json
{
  "scenario": "drift-watch",
  "baseUrl": "http://localhost:4100",
  "ignorePaths": [
    "timestamp"
  ],
  "endpointConfig": {
    "GET /api/trips": {
      "severity": "critical",
      "ignorePaths": []
    },
    "GET /api/booking/*": {
      "severity": "normal",
      "ignorePaths": []
    }
  }
}
```

- **`ignorePaths`**: Global volatile fields (e.g., `timestamp`) that change on every request
- **`severity: "critical"`**: Breaking changes fail CI; warnings are informational
- **`severity: "normal"`**: Downgrades all drift to warnings only
- **`endpointConfig[].ignorePaths`**: Per-endpoint volatile fields

## Dashboard UI Workflow (Future)

When the dashboard is running with the Drift tab enabled, you can:

1. Navigate to the Drift tab
2. Click "Run Check Now"
3. View drifted endpoints with their issues
4. Click "Accept Live" to re-record
5. Click "Ignore Field" to add ignorePaths
6. View drift history timeline

**Note**: The full dashboard UI demo requires building the frontend:

```bash
cd ../../packages/mockifyer-dashboard
npm install && npm run build
```

## Video & GIF Artifacts

For documentation purposes, record the CLI demo:

```bash
# Record terminal session with asciinema
asciinema rec drift-demo.cast
bash cli-demo.sh
# Ctrl+D to stop

# Convert to GIF
agg drift-demo.cast drift-demo.gif --speed 1.5
```

Or use screen recording software to capture the terminal workflow.

## CI Integration

Add to your workflow (optional, to prevent demo rot):

```yaml
- name: Test drift demo
  run: |
    cd demos/drift-live
    npm install
    bash cli-demo.sh
  if: github.event_name == 'schedule' # Only on nightly
```

## Troubleshooting

**Backend port in use:**
```bash
lsof -ti:4100 | xargs kill -9
```

**Reset mock files:**
```bash
git checkout mock-data/
```

**Dashboard not starting:**
Ensure dashboard backend is built:
```bash
cd ../../packages/mockifyer-dashboard
npx tsc
```

## What Makes This Demo Accurate

- **Real drift detection**: Uses `@sgedda/mockifyer-core/utils/drift`
- **Real backend changes**: Express server with actual schema evolution
- **Real config**: `mockifyer.drift.json` with ignorePaths and severity
- **Real mock files**: JSON mocks that update when accepting drift

## Related Documentation

- [DRIFT_PLAN.md](../../docs/DRIFT_PLAN.md) — Feature design
- [DRIFT_CHECK.md](../../docs/DRIFT_CHECK.md) — CLI and API reference
- [Dashboard routes](../../packages/mockifyer-dashboard/src/routes/drift.ts) — API implementation
