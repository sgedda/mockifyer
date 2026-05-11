---
name: Contract drift detection
overview: Detect when live or staged API responses diverge from committed mock “contracts” (shape, status, selected fields) so teams catch breaking API changes before production and keep golden scenarios trustworthy.
todos:
  - id: drift-policy-model
    content: Define drift severity levels, compare modes (shape-only vs selective fields), and per-scenario opt-in/out.
    status: pending
  - id: drift-signature-storage
    content: Persist lightweight contract signatures (hash or canonical JSON Schema-ish summary) alongside or inside mock metadata; versioning strategy.
    status: pending
  - id: drift-compare-engine
    content: Implement compare(actual vs expected) with redaction hooks; output structured DiffResult for CI and dashboard.
    status: pending
  - id: drift-record-hook
    content: Optional “record baseline” / refresh signature on demand from proxy or SDK when authorized.
    status: pending
  - id: drift-cli-ci
    content: CLI or npm script (e.g. mockifyer-drift-check) exit codes for CI; optional JSON report artifact.
    status: pending
  - id: drift-dashboard-surface
    content: Dashboard view or panel listing scenarios/mocks with drift status, last check, link to diff.
    status: pending
---

## Goal
Turn Mockifyer fixtures into **explicit contracts**: when reality (new build, staging, or a one-off fetch) **no longer matches** what the repo expects, surface that as **drift**—actionable for **CI gates** and **dashboard review**—without replacing full contract-testing suites (Pact, etc.).

## Problems this solves
- **Silent mock staleness**: mocks replay forever while the real API changed; tests pass, production breaks.
- **Golden scenario rot**: `ci` / locked scenarios slowly diverge from what backends actually return.
- **Cross-team coordination**: backend ships a field rename; mobile finds out late. Drift check fails the build with a **clear diff**.

## Non-goals (initially)
- Full **consumer-driven contract** negotiation (that’s Pact territory).
- Validating **every** field of **every** response in all environments (too noisy without tuning).
- Replacing **manual** exploratory testing or **E2E** assertions on UX.

## Concepts

### Contract artifact
For each stored mock (or per request key), define what “the app depends on”:

| Mode | Stored / derived | Drift means |
|------|------------------|-------------|
| **Shape** | Sorted key set + coarse types (`string`, `number`, `array`, `object`, null) | Keys missing/extra, type changed |
| **Status** | HTTP status from recorded response | Status code differs |
| **Snapshot (subset)** | Allowlisted JSON paths (e.g. `data.user.id`, `errors.0.code`) | Values differ at those paths |
| **Hash (optional)** | Stable hash of normalized body | Any change (noisiest; behind flag) |

Default recommendation: **shape + status** for breadth; **subset** for critical endpoints.

### Baseline source
- **Primary**: existing mock file body in `mock-data/<scenario>/…` (or Redis blob)—the **expected** side.
- **Actual**: response from a **drift run**—either HTTP call to configured base URL (staging) or body captured during **record** / **proxy** when `drift-check` mode is on.

### Severity
- **Breaking**: required key removed, type change, 4xx→2xx flip where not allowed.
- **Warning**: new optional keys, ordering-only noise (if comparing array order matters, flag it).
- **Info**: metadata-only (headers) if ever compared.

## Architecture (high level)

1. **Signature generation** (`packages/mockifyer-core` or dashboard util):  
   Given `expected` JSON + policy → `ContractSignature` (small JSON, storable).

2. **Compare**:  
   `compareSignatures(expected, actual)` or deep compare with policy → `DriftReport` per mock or per request key.

3. **Triggers**:
   - **CI**: CLI loads scenario, for each mock (or filtered list) GET staging equivalent **or** use last recorded “probe”—then compare.
   - **Dashboard**: “Run drift check” button per scenario; show table of pass/fail.
   - **Optional**: nightly workflow against staging.

4. **Storage**:
   - **Inline**: `mockifyer.contract` (or similar) inside mock JSON—versioned with the file.
   - **Sidecar**: `*.contract.json` to avoid touching large bodies (optional).
   - **Generated on demand**: no persistence; compare raw mock body to live response each run (simpler v1).

## Implementation phases

### Phase 1 — Core compare + CLI
- Policy: shape + status only.
- Input: path to scenario folder (filesystem) or Redis export snapshot.
- Config: `baseUrl`, headers (e.g. auth from env), mapping **mock request → probe URL** (usually same URL as `mock.request.url`).
- Output: stdout + `--json report.json`; exit `1` if any **breaking** drift.
- Respect **redaction** (same patterns as network log / recording): never print secrets in diffs.

### Phase 2 — Dashboard
- API: `POST /api/drift-check` with `{ scenario, baseUrl? }` or use server-side env for URL.
- UI: table by endpoint/key: status, last run, expand diff.
- Integrate with **scenario lock**: drift check **read-only** on locked scenarios; warn if trying to “update baseline”.

### Phase 3 — Selective fields + baselines
- Allowlist paths per mock or glob in scenario config.
- “Accept drift” flow: update mock body from actual (separate PR flow; dangerous—gate behind permission / unlock).

### Phase 4 — Redis-native + CI polish
- Drift against Redis-backed mocks without full filesystem export.
- GitHub Action example in repo; SARIF or PR comment (optional).

## Privacy & safety
- Drift runs hit **real** URLs: use **non-prod** base URL, **short-lived tokens** from CI secrets, **rate limits**.
- Logs: no full response bodies in CI logs by default—only diff paths + types.

## Test plan
- Unit: compare engine (fixtures for shape change, new key, type change, array length).
- Integration: small mock set + mocked HTTP server returning altered JSON → CLI fails with expected report.
- Manual: run against Ving staging with one intentionally broken field.

## Open questions
- **Auth**: how does CI authenticate to staging (token injection per request vs global header)?
- **GraphQL**: compare `data` subtree + `errors` pattern separately?
- **Pagination / timestamps**: exclude paths by convention or global ignore list?

## References in repo (today)
- Mock JSON layout: request/response in recorded files (`README`, `file-naming`).
- `generateRequestKey` / matching: align “same mock” identity with drift identity.
- Scenario lock + Redis: governance for who may refresh baselines.
