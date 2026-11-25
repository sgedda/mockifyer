# Mockifyer StackBlitz: Record → Replay → Generate

Runnable WebContainer (Node) demo:

1. **Record** real public API calls with `@sgedda/mockifyer-fetch` (selective allowlist — not capture-all)
2. **Replay** with the network blocked (proves mock hits)
3. **Generate** realistic edge-case variants from the recorded mock via `@sgedda/mockifyer-generator` / CLI `mockifyer-generate`

Uses published npm packages for fetch/core. The generator is listed as an **optionalDependency** because it is **not on npm yet**.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/sgedda/mockifyer/tree/main/examples/stackblitz-record-generate)

## What runs on open

StackBlitz installs dependencies and runs `npm start` → replay committed mocks, then attempts generate if the generator is available.

## Scripts

```bash
npm start          # replay (+ generate when available)
npm run record     # selective record from JSONPlaceholder + Open-Meteo
npm run replay     # serve mocks with network blocked
npm run generate   # mockifyer-generate variants <mock.json>
npm run sample     # mockifyer-generate sample --context '…'
```

## Selective recording (intended flow)

```js
setupMockifyer({
  mockDataPath: './mock-data',
  defaultScenario: 'default',
  recordMode: true,
  useGlobalFetch: true,
  domainPathRulesMode: 'allowlist', // default — not 'record_all'
  recordResponses: [
    'jsonplaceholder.typicode.com/users*',
    'api.open-meteo.com/v1/forecast*',
  ],
});
```

Only matching URLs get full response bodies. That is selective recording via `recordResponses` patterns + allowlist domain-path rules — **not** capture-all (`MOCKIFYER_RECORD_RESPONSES=true` / `domainPathRulesMode: 'record_all'`).

`domain-path-rules.seed.json` activates Record + Auto-mock for those two hosts only (same outcome as the dashboard Domains tree). Day-to-day apps often land request-only stubs in `_scratch` and activate them in the dashboard; this demo seeds the allowlist so it works without a dashboard (SQLite dashboard does not run in WebContainers).

## Public APIs (CORS-friendly)

| API | URL | CORS |
|-----|-----|------|
| JSONPlaceholder | `https://jsonplaceholder.typicode.com/users/1` | `Access-Control-Allow-Origin` echoes Origin |
| Open-Meteo | `https://api.open-meteo.com/v1/forecast?…` | `Access-Control-Allow-Origin: *` |

Verified with `Origin: https://stackblitz.com`. WebContainer outbound HTTPS goes through the browser, so CORS applies.

## Generator publish status

`@sgedda/mockifyer-generator` is **not published** (`npm view` → 404). Approach taken:

- **optionalDependency** so `npm install` still succeeds on StackBlitz / CI today
- `generate.js` / `sample.js` resolve the package from `node_modules`, else the monorepo `packages/mockifyer-generator/dist` (local clone)
- If neither is available, scripts exit with a clear publish hint; **record + replay still work**

| Capability | Works today? |
|------------|--------------|
| `npm run record` | Yes (needs outbound HTTPS) |
| `npm run replay` | Yes (committed mocks; network blocked) |
| `npm run generate` / `sample` on StackBlitz | **After** `generator-v0.1.0` publish |
| `npm run generate` / `sample` in this monorepo | Yes after `npm --prefix packages/mockifyer-generator run build` |

Do not publish from this example. Tag/publish from the package workflow when ready.

## StackBlitz / WebContainer notes

**Works:** Node `fs` mocks, `fetch` interception, record/replay scripts, generator CLI (once installed).

**Does not work:** `mockifyer-dashboard` (native SQLite), Redis, React Native, Docker.

## Open in StackBlitz snippet

```html
<a href="https://stackblitz.com/github/sgedda/mockifyer/tree/main/examples/stackblitz-record-generate">
  <img alt="Open in StackBlitz" src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" />
</a>
```

Markdown:

```md
[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/sgedda/mockifyer/tree/main/examples/stackblitz-record-generate)
```
