---
name: Mock corpus insights
overview: Lint recorded mocks and optional network events for health signals—duplicate request keys, status mix, simple burst/temporal hints—surfaced as structured warnings/errors in dashboard and optional CI, without pretending to be a full APM.
todos:
  - id: insights-types-policy
    content: Define Insight, InsightSeverity, AnalysisPolicy (per-scenario rules, status allow/forbid lists) in mockifyer-core.
    status: pending
  - id: insights-normalize
    content: Normalize mock records to analysis rows (requestKey via generateRequestKey, url, method, status, timestamp, source path / redis hash).
    status: pending
  - id: insights-engine-v1
    content: Implement analyzeMockCorpus() — aggregate counts, duplicate requestKey, status distribution, optional duplicate-ratio info.
    status: pending
  - id: insights-engine-temporal
    content: Optional second pass — burst detection when timestamps exist (same key N times in window); document limits without network log.
    status: pending
  - id: insights-api
    content: Dashboard GET /api/insights?scenario= — load fs + redis like stats, run engine, return JSON.
    status: pending
  - id: insights-ui
    content: Insights panel or tab — table by severity, link to mock filenames, copy JSON for CI.
    status: pending
  - id: insights-cli-optional
    content: Optional npm script / CLI — exit 1 on error-severity insights for CI; --json report path.
    status: pending
  - id: insights-network-log-followup
    content: After network log exists — feed NetworkEvent[] into same analyzer for sequence-level rules.
    status: pending
---

## Goal
Give teams **actionable, repo-native feedback** on their recorded data: “same logical request captured many times,” “unexpected status codes for this scenario,” “possible burst of identical calls”—as **structured `Insight[]`** suitable for **dashboard** and **optional CI gates**, not full performance profiling.

## Principles
- **Advisory first**: default severities are **info** / **warn**; **error** only via explicit **policy** (e.g. golden scenario forbids `5xx`).
- **Honest limits**: “Unnecessary traffic” is **heuristic** without navigation context; sequence rules need **ordered events** (timestamps on mocks or **network log** from `dashboard-network-log.md`).
- **Reuse data**: same inputs as **stats** (`mocks` list per scenario); no new persistence for v1.

## What’s already there
- **`stats.ts`**: aggregates endpoints, methods, status codes, recent activity from fs + Redis.
- **`generateRequestKey`** (core): stable identity for requests—align **duplicate detection** with matching semantics.
- **Network log (planned)**: future **ordered** feed for stronger burst / miss patterns.

## Event / row model (analyzer input)
Each contributor becomes one **analysis row**:

| Field | Source |
|--------|--------|
| `requestKey` | `generateRequestKey(mock.request)` (or hash fallback) |
| `method`, `url`, `status` | `mock.request`, `mock.response` |
| `timestamp` | `mock.timestamp` if present |
| `ref` | filesystem relative path or `redis/<hash>.json` |

## Rules (v1 — corpus only)

| Rule id | Condition | Default severity |
|---------|-----------|------------------|
| `DUPLICATE_REQUEST_KEY` | Same `requestKey` appears in >1 mock file/blob | warn |
| `HIGH_DUPLICATE_RATIO` | Many files, few unique keys (configurable threshold) | info |
| `UNEXPECTED_STATUS` | Status outside policy allowlist for scenario | warn or error |
| `ERROR_STATUS_PRESENT` | Any `5xx` (or `4xx` policy) in scenario | policy-driven |

## Rules (v2 — temporal, optional)
When **timestamps** parseable on **≥2** rows per key:

| Rule id | Condition | Default severity |
|---------|-----------|------------------|
| `BURST_SAME_KEY` | Same `requestKey` **≥ N** times in **T** ms | warn |

**Without** reliable timestamps or **network log**, skip or degrade with docstring.

## Rules (v3 — network log integration)
After `NetworkEvent` stream exists:

- **Many upstream misses** in `ci` scenario → warn.
- **Passthrough storm** on resource that has mocks → warn (configurable).

## Architecture
1. **`packages/mockifyer-core`**
   - `src/utils/mock-insights.ts` (names TBD): types, `normalizeMockToRow()`, `analyzeRows(rows, policy)`.
   - Unit tests: fixtures for duplicate keys, status policy, burst window.
2. **`packages/mockifyer-dashboard`**
   - `src/routes/insights.ts`: `GET /api/insights?scenario=` — context from `getDashboardContext`, list mocks (reuse patterns from `stats` / `mocks`), build rows, call `analyzeRows`.
   - Register in server bootstrap (same as other routers).
3. **Frontend**
   - New view or section under **Stats** or **Settings**: list insights, badges, deep link to `/mocks` or filename.
4. **CI (optional)**
   - `node` script or `mockifyer-dashboard` subcommand: load path, run analyzer, `process.exit` on `error` severity.

## Policy storage (v1)
- **Inline**: defaults in code (golden scenario name list optional env).
- **Later**: `mock-insights.config.json` at mock root or per-scenario `insights.json` (defer until users ask).

## Privacy
- Insights reference **URLs and paths**, not bodies; keep messages short; no token logging.

## Test plan
- Core: table-driven tests for each rule + policy overrides.
- Dashboard: smoke test `GET /api/insights` returns `{ insights: [] }` for empty scenario.
- Manual: duplicate a mock intentionally → see `DUPLICATE_REQUEST_KEY`.

## Milestones
1. **Core engine + policy + tests** (no UI).
2. **GET /api/insights** wired for fs + Redis.
3. **Minimal dashboard UI**.
4. **Optional CLI + CI doc**.
5. **Network log adapter** when Phase 1 of `dashboard-network-log.md` ships.

## References
- `.cursor/plans/dashboard-network-log.md` — ordered events for v2/v3.
- `.cursor/plans/contract-drift-detection.md` — complementary “live vs expected” checks; insights are “corpus hygiene.”
