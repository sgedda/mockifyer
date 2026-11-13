# Drift Detection Live Demo

A reproducible demonstration of Mockifyer's drift detection, showing how to detect, investigate, and resolve API contract changes.

## What This Demo Shows

This demo simulates a complete drift detection workflow:

1. **Initial state**: Drift check against v1 API → all green ✓
2. **API changes**: Backend switches to v2 with breaking changes
3. **Drift detected**: Check shows breaking drift
4. **Resolution**: Accept live response for affected endpoints
5. **Verification**: Re-run check → all green ✓

## Breaking Changes (v1 → v2)

The demo backend simulates real API evolution:

| Endpoint | Change | Type | Severity |
|----------|--------|------|----------|
| `/api/trips` | `departureDate` → `departsAt` | Field renamed | Breaking |
| `/api/trips` | `passengers`: number → string | Type changed | Breaking |
| `/api/trips` | `class` added | New field | Warning |
| `/api/booking/:id` | `confirmationDate` → `confirmedAt` | Field renamed | Breaking |
| `/api/booking/:id` | `price`: number → string | Type changed | Breaking |
| `/api/booking/:id` | `currency` added | New field | Warning |

**Volatile fields** (ignored via `mockifyer.drift.json`):
- `trips[].id`, `booking.bookingId`, `timestamp`

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
├── backend.js                 # Express server (v1/v2 modes)
├── cli-demo.sh                # Automated CLI workflow
├── mockifyer.drift.json       # Drift check configuration
├── package.json               # Dependencies and scripts
├── mock-data/
│   └── drift-watch/           # Recorded mocks from v1
│       ├── domain-path-rules.json
│       └── localhost:4100/
│           └── api/
│               ├── trips/GET.json
│               └── booking/GET_abc123.json
└── README.md                  # This file
```

## Configuration

**`mockifyer.drift.json`:**

```json
{
  "scenario": "drift-watch",
  "baseUrl": "http://localhost:4100",
  "ignorePaths": [
    "trips[].id",
    "timestamp",
    "booking.bookingId"
  ],
  "endpointConfig": {
    "GET /api/trips": {
      "severity": "critical"
    },
    "GET /api/booking/*": {
      "severity": "normal"
    }
  }
}
```

- **`ignorePaths`**: Volatile fields (IDs, timestamps) that change on every request
- **`severity: "critical"`**: Breaking changes fail CI
- **`severity: "normal"`**: Downgrades all drift to warnings

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
