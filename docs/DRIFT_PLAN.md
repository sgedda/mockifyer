# Drift Detection — Phased Implementation Plan

**Goal:** Catch API changes before they break production through automated contract drift detection with actionable workflows.

**Principles:**
- Developer experience first — minimal config, actionable output
- Selective recording by default — only check mocks that are actually used
- Time-sensitive data handled via existing date manipulation
- GET-only safety by default

---

## Phase 1: Foundation ✓ (Merged PR #519)

**Delivered:**
- Core comparison engine (`packages/mockifyer-core/src/utils/drift/`)
- `checkDrift()` programmatic API
- `mockifyer-drift-check` CLI with zero-config operation
- Detection of structural changes: status, missing/new keys, type changes
- Config file support (`mockifyer.drift.json` or `package.json` `mockifyer.drift` section)
- CLI flags: `--base-url`, `--header`, `--ignore-path`, `--fail-on-warnings`, `--json`
- Exit codes: 0 (clean), 1 (drift), 2 (error)
- Documentation in `docs/DRIFT_CHECK.md`

**Report Schema (Phase 1):**

```typescript
interface DriftCheckReport {
  totalMocks: number;
  driftedMocks: number;
  breakingDriftCount: number;
  warningOnlyCount: number;
  skippedCount: number;
  notCheckedCount: number;
  mockReports: MockDriftReport[];
  summary: string;
  failOnWarnings: boolean;
}

interface MockDriftReport {
  method: string;
  url: string;
  mockFilePath?: string;
  hasDrift: boolean;
  hasBreakingDrift: boolean;
  issues: DriftIssue[];
  skipped?: boolean;
  skipReason?: string;
  notChecked?: boolean;
  notCheckedReason?: string;
}

interface DriftIssue {
  path: string;
  type: 'status_change' | 'missing_key' | 'extra_key' | 'type_change';
  severity: 'breaking' | 'warning';
  expected?: string;
  actual?: string;
  message: string;
}
```

---

## Phase 2: History, Metadata & Acceptance (This PR)

### 2.1 Drift Watch Scenario Support

**Feature:** Run drift checks against one named scenario (e.g., `drift-watch`).

**Workflow:**
1. Record against staging/production normally
2. Promote 10-30 important endpoints into a dedicated `drift-watch` scenario
3. Run nightly drift checks: `mockifyer-drift-check --scenario drift-watch`

**CLI:**
```bash
mockifyer-drift-check --scenario drift-watch
```

**Config (`mockifyer.drift.json`):**
```json
{
  "scenario": "drift-watch"
}
```

**Implementation:** Already supported in phase 1 via `--scenario` flag. Documentation enhancement only.

---

### 2.2 Per-Endpoint Drift Metadata

**Feature:** Configure `ignorePaths` and `severity` per mock or endpoint pattern, without editing mock JSON files.

**Format — Config Map Approach:**

Stored in `mockifyer.drift.json` or `package.json` `mockifyer.drift`:

```json
{
  "endpointConfig": {
    "GET /api/users": {
      "severity": "critical",
      "ignorePaths": ["lastLoginAt", "createdAt"]
    },
    "POST /api/orders": {
      "severity": "normal",
      "ignorePaths": ["orderNumber", "timestamp"]
    },
    "GET /api/trips/*": {
      "severity": "critical",
      "ignorePaths": ["estimatedArrival"]
    }
  }
}
```

**Severity Levels:**
- `critical` (default for endpoints with config) — breaking changes fail CI (exit 1)
- `normal` — warnings only, unless `--fail-on-warnings` is set
- Pattern matching supports exact paths (`GET /api/users`) and wildcards (`GET /api/trips/*`)

**Rationale:** Config map keeps mock files clean and readable, supports pattern matching, centralizes drift rules in one place. Does not pollute the mock data schema.

**Schema Addition:**

```typescript
interface DriftConfig {
  scenario?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  ignorePaths?: string[]; // Global ignore paths
  failOnWarnings?: boolean;
  allowUnsafeMethods?: boolean;
  concurrency?: number;
  timeoutMs?: number;
  delayMs?: number;
  endpointConfig?: Record<string, EndpointDriftConfig>;
}

interface EndpointDriftConfig {
  severity?: 'critical' | 'normal';
  ignorePaths?: string[];
}
```

**CLI Override:**
```bash
# Override severity for specific endpoint (not implemented in phase 2; config-only)
mockifyer-drift-check --scenario drift-watch
```

---

### 2.3 History Tracking

**Feature:** Each run writes a timestamped report into `.drift/` under the scenario folder, with `firstSeen` and `lastSeen` per drift for continuity across runs.

**Directory Structure:**

```
mock-data/
  drift-watch/
    .drift/
      latest.json             ← Symlink or copy of most recent report
      2026-11-13T12-00-00Z.json
      2026-11-14T12-00-00Z.json
      2026-11-15T12-00-00Z.json
    api.example.com/
      users/
        GET_123.json
```

**Report Format (`.drift/*.json`):**

```typescript
interface DriftHistoryReport extends DriftCheckReport {
  timestamp: string; // ISO 8601 (e.g., "2026-11-13T12:00:00.000Z")
  gitCommit?: string; // Git SHA at time of check (if available)
  gitBranch?: string; // Git branch name (if available)
  reportVersion: 1; // Schema version for future compatibility
  mockReports: MockDriftReportWithHistory[];
}

interface MockDriftReportWithHistory extends MockDriftReport {
  issues: DriftIssueWithHistory[];
  snoozedUntil?: string; // ISO 8601 (when snoozed)
}

interface DriftIssueWithHistory extends DriftIssue {
  firstSeen: string; // ISO 8601 (first detected)
  lastSeen: string; // ISO 8601 (most recent)
  occurrences: number; // Times seen in a row
}
```

**Retention:**
- Keep last 30 reports by default
- Configurable via `historyRetention` in config (default: 30)
- Oldest reports deleted automatically on each run

**Config:**
```json
{
  "historyRetention": 30
}
```

**CLI:**
```bash
# Skip writing history (useful for local/ad-hoc checks)
mockifyer-drift-check --no-history
```

**Git Context:** If `.git` exists and `git` is available, record the current commit SHA and branch in the report for traceability.

---

### 2.4 Accept and Update

**Feature:** Re-fetch a live endpoint and update the mock file with the new response, preserving metadata and ignore rules.

**CLI:**

```bash
# Accept one endpoint's drift (re-record from live)
mockifyer-drift-check --accept "GET /api/users/123"

# Accept all endpoints that only have warnings
mockifyer-drift-check --accept-all-warnings

# Persist an ignore rule for a specific endpoint
mockifyer-drift-check --ignore-field "GET /api/users/123" "lastLoginAt"

# Snooze an endpoint for N days (default 7)
mockifyer-drift-check --snooze "GET /api/users/123" --days 30
```

**Implementation Notes:**

1. **`--accept <method> <path>`**
   - Finds the mock file matching `method` and `path`
   - Makes a live request (using `baseUrl` and `headers` from config)
   - Overwrites `response.data` and `response.status` in the mock JSON
   - Preserves `request`, `metadata`, `scenario`, and all other fields
   - Writes a minimal diff (only `response` changes)
   - Fails gracefully if endpoint is unreachable or returns error

2. **`--accept-all-warnings`**
   - Runs normal drift check first
   - Filters to mocks with `hasDrift: true` and `hasBreakingDrift: false`
   - Applies `--accept` logic to each
   - Reports accepted count and any failures

3. **`--ignore-field <endpoint> <path>`**
   - Adds an entry to `endpointConfig` in the config file
   - Merges with existing `ignorePaths` if endpoint already has config
   - Writes minimal change to `mockifyer.drift.json` (preserves formatting)

4. **`--snooze <endpoint> --days N`**
   - Records a snooze expiration in the history report
   - Drift check skips the endpoint if `snoozedUntil` is in the future
   - Reports the endpoint as "snoozed" instead of drifted
   - Expiration resets on next run after the snooze expires

**Exit Codes (Unchanged):**
- Accept/update commands exit 0 on success, 2 on error
- Normal checks: 0 (clean), 1 (drift), 2 (error)

---

### 2.5 Programmatic API Exports

**Feature:** Export drift management functions for use in the dashboard (phase 3).

**New Exports from `@sgedda/mockifyer-core/utils/drift`:**

```typescript
export {
  checkDrift,
  acceptDrift,
  acceptAllWarnings,
  snoozeEndpoint,
  addIgnoreField,
  loadDriftHistory,
  writeDriftHistory,
} from './drift-management';

export type {
  DriftCheckReport,
  DriftHistoryReport,
  MockDriftReport,
  MockDriftReportWithHistory,
  DriftIssue,
  DriftIssueWithHistory,
  DriftCheckOptions,
  DriftConfig,
  EndpointDriftConfig,
} from './drift-report';
```

**Functions:**

```typescript
/**
 * Accept drift for one endpoint: re-fetch live and update mock file.
 */
export async function acceptDrift(options: {
  method: string;
  path: string;
  mockDataPath: string;
  scenario: string;
  driftOptions: DriftCheckOptions;
}): Promise<{ success: boolean; message: string; filePath?: string }>;

/**
 * Accept all warnings (non-breaking drift).
 */
export async function acceptAllWarnings(options: {
  mockDataPath: string;
  scenario: string;
  driftOptions: DriftCheckOptions;
}): Promise<{ accepted: number; failed: number; messages: string[] }>;

/**
 * Snooze an endpoint for N days.
 */
export async function snoozeEndpoint(options: {
  method: string;
  path: string;
  days: number;
  mockDataPath: string;
  scenario: string;
}): Promise<{ success: boolean; message: string; expiresAt: string }>;

/**
 * Add an ignore path for a specific endpoint to config file.
 */
export async function addIgnoreField(options: {
  endpoint: string; // "GET /api/users/123"
  jsonPath: string;
  configPath?: string; // Default: "mockifyer.drift.json"
}): Promise<{ success: boolean; message: string }>;

/**
 * Load drift history for a scenario.
 */
export function loadDriftHistory(
  mockDataPath: string,
  scenario: string
): DriftHistoryReport | null;

/**
 * Write drift history report and clean up old reports.
 */
export async function writeDriftHistory(
  report: DriftHistoryReport,
  mockDataPath: string,
  scenario: string,
  retention?: number
): Promise<void>;
```

---

## Phase 3: Dashboard UI (Future PR)

**Scope:** Drift visualization in `packages/mockifyer-dashboard`.

**Features:**
1. **Drift Tab** — Table of endpoints with drift status, severity, and first/last seen
2. **Per-Endpoint Detail View** — Side-by-side diff of expected vs. actual response shape
3. **Actions:**
   - **Accept** — Re-record this endpoint from live
   - **Ignore Field** — Add `ignorePath` for specific JSON path
   - **Snooze** — Acknowledge drift for N days
4. **GitHub Actions Workflow Example** — Nightly drift check that opens/updates one GitHub issue or PR with drift summary
5. **History Timeline** — Show drift trends over time

**Implementation Notes:**
- Dashboard reads `.drift/latest.json` and history
- Actions call the programmatic APIs from phase 2
- No changes to core drift logic — only UI and orchestration

---

## Phase 4: Guide & Best Practices (Future)

**Scope:** Comprehensive guide on `mockifyer.dev`.

**Topics:**
1. Drift watch scenario setup (selective recording)
2. Ignoring time-sensitive fields vs. date freezing
3. CI integration examples (GitHub Actions, GitLab CI, CircleCI, etc.)
4. Troubleshooting common drift patterns
5. Balancing drift sensitivity (critical vs. normal endpoints)
6. Team workflows (who accepts drift, when to snooze, etc.)

---

## Frozen Schemas (Phase 2+)

**These schemas MUST remain backward-compatible for phase 3+.**

### Drift Config Schema v1

```typescript
interface DriftConfig {
  scenario?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  ignorePaths?: string[];
  failOnWarnings?: boolean;
  allowUnsafeMethods?: boolean;
  concurrency?: number;
  timeoutMs?: number;
  delayMs?: number;
  historyRetention?: number; // Default: 30
  endpointConfig?: Record<string, EndpointDriftConfig>;
}

interface EndpointDriftConfig {
  severity?: 'critical' | 'normal';
  ignorePaths?: string[];
}
```

### Drift History Report Schema v1

```typescript
interface DriftHistoryReport {
  reportVersion: 1;
  timestamp: string; // ISO 8601
  gitCommit?: string;
  gitBranch?: string;
  totalMocks: number;
  driftedMocks: number;
  breakingDriftCount: number;
  warningOnlyCount: number;
  skippedCount: number;
  notCheckedCount: number;
  mockReports: MockDriftReportWithHistory[];
  summary: string;
  failOnWarnings: boolean;
}

interface MockDriftReportWithHistory {
  method: string;
  url: string;
  mockFilePath?: string;
  hasDrift: boolean;
  hasBreakingDrift: boolean;
  issues: DriftIssueWithHistory[];
  skipped?: boolean;
  skipReason?: string;
  notChecked?: boolean;
  notCheckedReason?: string;
  snoozedUntil?: string; // ISO 8601
}

interface DriftIssueWithHistory {
  path: string;
  type: 'status_change' | 'missing_key' | 'extra_key' | 'type_change';
  severity: 'breaking' | 'warning';
  expected?: string;
  actual?: string;
  message: string;
  firstSeen: string; // ISO 8601
  lastSeen: string; // ISO 8601
  occurrences: number; // Consecutive runs with this issue
}
```

---

## Testing Strategy

**Phase 1 Tests:** ✓
- Core comparison engine (`drift-compare-engine.test.ts`)
- Integration tests (`drift-check-integration.test.ts`)

**Phase 2 Tests (This PR):**
- Per-endpoint config resolution and pattern matching
- History persistence and retention
- Accept/update operations (minimal mock file diffs)
- Snooze logic (date expiration)
- Programmatic API behavior
- CLI argument parsing for new flags

**Phase 3 Tests (Future):**
- Dashboard UI interactions
- API endpoint handlers for drift actions
- GitHub Actions workflow smoke test

---

## CLI Summary (Phase 2)

```bash
# Check drift with history enabled (default)
mockifyer-drift-check --scenario drift-watch

# Skip history (local/ad-hoc checks)
mockifyer-drift-check --no-history

# Accept one endpoint's drift
mockifyer-drift-check --accept "GET /api/users/123"

# Accept all warnings
mockifyer-drift-check --accept-all-warnings

# Ignore a field for a specific endpoint
mockifyer-drift-check --ignore-field "GET /api/users/123" "lastLoginAt"

# Snooze an endpoint for 30 days
mockifyer-drift-check --snooze "GET /api/users/123" --days 30
```

---

## Open Questions

**Q: Should snooze state live in history JSON or a separate file?**
A: In history JSON (`snoozedUntil` field). This keeps snooze state visible in the timeline and avoids introducing another file format. If the history is deleted, snoozes are cleared (acceptable trade-off).

**Q: Should `--accept` also commit the change?**
A: No. Drift check is read-mostly. Let the user review and commit manually, or script it if they want auto-commits.

**Q: What if a mock file was manually edited since last drift check?**
A: Accept overwrites `response` fields unconditionally. Manual edits to `request` or metadata are preserved. Users should review diffs before committing.

**Q: Should severity be configurable per-field, not just per-endpoint?**
A: Not in phase 2. Per-endpoint is sufficient for most workflows. If needed, phase 4 can add per-field severity via more granular config.

---

## Migration Path

**Phase 1 → Phase 2:**
- Existing configs remain valid (backward-compatible)
- New fields (`endpointConfig`, `historyRetention`) are optional
- CLI flags are additive (old scripts continue to work)
- Reports written before phase 2 lack `reportVersion` and history fields; treat as version 0 (legacy)

**Phase 2 → Phase 3:**
- Dashboard reads frozen schema v1 reports
- No breaking changes to programmatic API

**Phase 3 → Phase 4:**
- Documentation and workflow guidance only; no code changes

---

## Timeline

- **Phase 1:** ✓ Merged PR #519 (2026-11-13)
- **Phase 2:** This PR (core only, no dashboard)
- **Phase 3:** Drift tab in dashboard + GitHub Actions integration (future PR)
- **Phase 4:** Guide on mockifyer.dev (documentation only)

---

## Success Criteria (Phase 2)

✓ Frozen schemas for config and history reports
✓ Per-endpoint metadata (config map with pattern matching)
✓ History tracking with `.drift/` directory and retention
✓ Accept, accept-all-warnings, ignore-field, snooze commands
✓ Programmatic API exports for dashboard reuse
✓ Tests for all new features
✓ Updated `docs/DRIFT_CHECK.md` with phase 2 examples
✓ No version bumps (as requested)
✓ GET-only safety preserved
