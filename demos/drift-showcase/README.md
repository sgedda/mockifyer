# Drift Showcase

A live demonstration of Mockifyer's drift detection, published nightly to [https://sgedda.github.io/mockifyer/drift/](https://sgedda.github.io/mockifyer/drift/).

## What This Showcases

This demo runs drift detection against:

1. **Simulated drift** (localhost:4200/api/weather): A controllable endpoint demonstrating breaking changes and warnings
2. **Real live APIs**: 
   - Open-Meteo weather API (https://api.open-meteo.com)
   - Frankfurter currency API (https://api.frankfurter.app)

The HTML report shows which endpoints have drifted, what changed, and how to resolve drift.

## Local Testing

```bash
# Install dependencies
npm install

# Terminal 1: Start drift simulator in v1 mode (stable) on port 4290
npm start

# Terminal 2: Run drift check (should pass)
cd ../..
npx mockifyer-drift-check --mock-data-path demos/drift-showcase/mock-data --scenario drift-watch

# Terminal 1: Stop and restart in v2 mode (with drift)
# Ctrl+C
npm run start:v2

# Terminal 2: Run drift check again (should detect drift)
npx mockifyer-drift-check --mock-data-path demos/drift-showcase/mock-data --scenario drift-watch --html /tmp/drift-report

# View the HTML report
open /tmp/drift-report/index.html  # macOS
xdg-open /tmp/drift-report/index.html  # Linux
```

## Simulated Drift (v1 → v2)

The drift simulator demonstrates common API breaking changes:

| Change | v1 (Stable) | v2 (Drift) | Severity |
|--------|-------------|------------|----------|
| Field renamed | `temperature: 22` | `temp_celsius: 22` | Breaking |
| Field removed | `temperature` exists | `temperature` removed | Breaking |
| Type changed | `conditions: "Sunny"` | `conditions: ["Sunny", "Clear"]` | Breaking |
| New field | _(none)_ | `humidity: 65` | Warning |

This clearly labeled **simulated** drift appears in the HTML report alongside real API results.

## CI Integration

See `.github/workflows/drift.yml` for the nightly workflow that:
1. Starts the drift simulator
2. Runs drift check against simulated + real APIs
3. Generates HTML report
4. Publishes to GitHub Pages at `/drift/`

## Files

- `drift-simulator.js` — Express server with v1/v2 modes
- `mock-data/drift-watch/` — Recorded mocks (v1 baseline)
- `mockifyer.drift.json` — Drift check configuration
- `package.json` — Dependencies (express only)
