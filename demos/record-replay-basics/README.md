# Mockifyer: Record & Replay Basics

This demo shows the core Mockifyer workflow:

1. **Record** real API responses from `demo.devxtools.dev`
2. **Replay** them offline (no network needed)
3. **Switch scenarios** (empty list, error states)
4. **Freeze dates** for time-dependent tests

## Try it

### Option 1: Record new mocks

```bash
npm run record
```

This calls `demo.devxtools.dev/tasks` and saves the response to `mock-data/default/`.

### Option 2: Run tests (replay mode)

```bash
npm test
```

Tests replay recorded responses from `mock-data/` — no network needed!

## What's happening

- `record.js`: Calls the real API with `recordMode: true`
- `api.test.js`: Replays from disk with `recordMode: false`
- `mock-data/default/`: JSON files with recorded request/response pairs
- `mock-data/tasks-empty/`: Alternative scenario (empty array)
- `mock-data/tasks-error/`: Error scenario (500 status)

## Key features shown

✓ Record once, replay forever  
✓ Switch scenarios in tests  
✓ Freeze dates with `getCurrentDate()`  
✓ No network = no flakes
