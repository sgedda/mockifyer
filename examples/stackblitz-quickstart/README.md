# Mockifyer StackBlitz Quickstart

Minimal Node starter: **record** one real HTTPS call, then **replay** it with the network blocked.

Uses published npm packages (`@sgedda/mockifyer-fetch`, `@sgedda/mockifyer-core`) — no monorepo `file:` links.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/sgedda/mockifyer/tree/main/examples/stackblitz-quickstart)

## What runs on open

StackBlitz installs dependencies and runs `npm start` → `node replay.js`.

A committed mock under `mock-data/default/` means replay works immediately, even offline.

## Scripts

```bash
npm start          # same as replay (default startCommand)
npm run replay     # serve the recorded mock; network is blocked
npm run record     # call jsonplaceholder.typicode.com and write a new mock
```

## Config (capture-all — quick demo only)

`record.js` uses the three capture-all settings so the first call is fully recorded and immediately replayable:

| Setting | Value |
|---------|--------|
| `MOCKIFYER_RECORD_RESPONSES` | `true` |
| `MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API` | `false` |
| `domainPathRulesMode` | `'record_all'` |

For day-to-day apps, prefer **selective recording** (request-only stubs in `_scratch`, activate in the dashboard). See [Getting Started](https://mockifyer.dev/getting-started).

## StackBlitz / WebContainer notes

**Works here:** Node `fs` mock files, `fetch` interception, record + replay scripts.

**Does not work here:** `mockifyer-dashboard` (native SQLite), Redis, React Native, Docker.

Outbound HTTPS for `npm run record` depends on WebContainer networking; if record fails in the browser IDE, run record locally and keep using replay on StackBlitz.
