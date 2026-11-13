# Drift Check

**Contract drift detection** — catch API changes before they break production.

Mockifyer provides the `mockifyer-drift-check` command and `checkDrift()` function. **Your project decides when to run it** — typically as a scheduled CI job (nightly), not in your main test suite.

Drift check compares your recorded mock responses with live API responses to detect **structural changes**: status codes, missing/new keys, and type changes. **It ignores changing values** (dates, IDs, request timestamps) — use [Mockifyer's date manipulation](#time-sensitive-data--date-freezing) for time-sensitive replay data.

Security: Never exposes actual values (only types and paths), so secrets stay safe.

## Quick Start

```bash
# Zero-config: check default scenario against recorded URLs
npx mockifyer-drift-check

# Check a specific scenario
npx mockifyer-drift-check --scenario staging

# Override base URL (e.g., test against staging API)
npx mockifyer-drift-check --base-url https://staging.api.example.com

# With authentication
npx mockifyer-drift-check --header "Authorization: Bearer ${API_TOKEN}"
```

## Recommended Setup: Nightly CI Job

**Do NOT run drift check in your normal `npm test` suite.** Drift checking hits live APIs and is slower than unit tests. Instead, run it on a schedule (e.g., nightly) or on-demand.

### Copy-paste GitHub Actions workflow (recommended)

Create `.github/workflows/drift-check.yml`:

```yaml
name: API Drift Check

on:
  schedule:
    - cron: '0 3 * * *'  # Nightly at 3am UTC
  workflow_dispatch:      # Allow manual runs

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Check for API drift
        run: npx mockifyer-drift-check --scenario production --header "Authorization: Bearer ${{ secrets.API_TOKEN }}"
        
      - name: Upload drift report (on failure)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: drift-report
          path: drift-report.json
```

This workflow:
- Runs nightly at 3am UTC (adjust `cron` to your timezone)
- Can be triggered manually from the Actions tab (`workflow_dispatch`)
- Fails the job if breaking drift is detected
- Uploads a JSON report on failure for debugging

### GitLab CI (scheduled pipeline)

```yaml
api-drift-check:
  script:
    - npm ci
    - npx mockifyer-drift-check --scenario production --header "Authorization: Bearer $API_TOKEN" --json > drift-report.json
  artifacts:
    when: on_failure
    paths:
      - drift-report.json
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"  # Only on scheduled runs
```

## Optional: Opt-in Test (Gated by Env Var)

If you want drift check available in `npm test` but not running by default, gate it with an environment variable:

**`tests/drift-check.test.ts`:**

```typescript
import { checkDrift } from '@sgedda/mockifyer-core/utils/drift';

// Only run when explicitly enabled
const DRIFT_CHECK_ENABLED = process.env.DRIFT_CHECK === '1';

(DRIFT_CHECK_ENABLED ? describe : describe.skip)('API Drift Check', () => {
  it('should detect no drift in production scenario', async () => {
    const report = await checkDrift({
      scenario: 'production',
      driftOptions: {
        baseUrl: process.env.API_BASE_URL,
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      },
    });

    expect(report.breakingDriftCount).toBe(0);
  }, 30000); // 30s timeout for live API calls
});
```

**Run it manually:**

```bash
DRIFT_CHECK=1 npm test
```

**Or in CI:**

```yaml
- name: Run drift check (as test)
  run: DRIFT_CHECK=1 npm test
  env:
    API_BASE_URL: https://api.example.com
    API_TOKEN: ${{ secrets.API_TOKEN }}
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-s, --scenario <name>` | Scenario to check | `default` |
| `-m, --mock-data-path <path>` | Mock data folder | Auto-detected |
| `-b, --base-url <url>` | Override base URL for live requests | Use mock URLs |
| `-H, --header <name:value>` | Add header (repeatable for multiple) | None |
| `-i, --ignore-path <path>` | JSON path to ignore (repeatable) | None |
| `--allow-unsafe-methods` | Check POST/PUT/DELETE (default: GET only) | `false` |
| `--fail-on-warnings` | Exit 1 on warnings (default: breaking only) | `false` |
| `-c, --concurrency <n>` | Max concurrent requests | `5` |
| `--timeout <ms>` | Request timeout | `10000` |
| `--delay <ms>` | Delay between request batches | `100` |
| `--json` | Output JSON report | `false` |

## Config File (Optional)

Store drift check settings in `mockifyer.drift.json` or `package.json`:

**`mockifyer.drift.json`:**

```json
{
  "scenario": "production",
  "baseUrl": "https://api.example.com",
  "headers": {
    "Authorization": "Bearer ${API_TOKEN}"
  },
  "ignorePaths": ["timestamp", "meta.requestId"],
  "failOnWarnings": false,
  "concurrency": 10,
  "timeoutMs": 15000
}
```

**Or in `package.json`:**

```json
{
  "name": "my-app",
  "mockifyer": {
    "drift": {
      "scenario": "production",
      "baseUrl": "https://api.example.com",
      "ignorePaths": ["timestamp", "meta.requestId"]
    }
  }
}
```

**CLI flags override config.** Config headers support env var references (`${VAR_NAME}`).

## Time-Sensitive Data & Date Freezing

Drift check **ignores changing values** (only compares structure). For time-sensitive data like "upcoming trips" or "recent orders":

1. **Empty live lists are not errors:** When a live API returns an empty array (e.g., upcoming trips have passed), drift check reports it as "not checked" and does **not fail CI**.

2. **Use Mockifyer's date manipulation for replay:** If your tests depend on specific dates, use [Mockifyer's date manipulation features](../README.md#date-configuration) to freeze time during replay:

```typescript
setupMockifyer({
  mockDataPath: './mock-data',
  dateManipulation: {
    fixedDate: '2024-01-15T00:00:00Z',  // Freeze at Jan 15, 2024
  },
});
```

This keeps "upcoming trips" in the future during tests, while drift check can still validate the API structure against a live staging environment.

**See also:** [Date Configuration in the main README](../README.md#date-configuration)

## What Drift Check Detects

Drift check compares **structure** (keys and types), not **values**. Changing dates, IDs, and request timestamps are ignored — only schema-level changes are reported.

### Breaking Changes (Exit 1)

- **Status change:** HTTP status differs (e.g., 200 → 404)
- **Missing key:** Expected field removed from response
- **Type change (non-null):** Field type changed (e.g., `number` → `string`)

### Warnings (Exit 0 unless `--fail-on-warnings`)

- **New key:** New field added to response
- **Null change:** Field became `null` or vice versa (less critical than type changes)

## Output

**Human-friendly (default):**

```
✗ 3 of 42 mocks drifted: 1 breaking, 2 warnings

Drifted mocks:

  BREAKING GET https://api.example.com/users/123
  File: mock-data/default/api.example.com/users/GET_123.json
    ✗ - email (string)
    ✗ ~ id: number → string

  WARNING GET https://api.example.com/posts
  File: mock-data/default/api.example.com/posts/GET.json
    ⚠ + createdAt (string)
    ⚠ + updatedAt (string)

→ Breaking changes detected. Review the API changes and update your mocks.
```

**JSON output (`--json`):**

```json
{
  "totalMocks": 42,
  "driftedMocks": 3,
  "breakingDriftCount": 1,
  "warningOnlyCount": 2,
  "skippedCount": 0,
  "summary": "✗ 3 of 42 mocks drifted: 1 breaking, 2 warnings",
  "mockReports": [
    {
      "method": "GET",
      "url": "https://api.example.com/users/123",
      "mockFilePath": "mock-data/default/api.example.com/users/GET_123.json",
      "hasDrift": true,
      "hasBreakingDrift": true,
      "issues": [
        {
          "path": "email",
          "type": "missing_key",
          "severity": "breaking",
          "expected": "string",
          "message": "Key \"email\" removed"
        },
        {
          "path": "id",
          "type": "type_change",
          "severity": "breaking",
          "expected": "number",
          "actual": "string",
          "message": "Type changed from number to string at id"
        }
      ]
    }
  ]
}
```

## Ignore Paths

Use `--ignore-path` to skip fields that change frequently (timestamps, request IDs, pagination cursors):

```bash
mockifyer-drift-check \
  --ignore-path timestamp \
  --ignore-path meta.requestId \
  --ignore-path pagination.cursor
```

Ignoring a path also ignores all its children:

```bash
# Ignores meta.timestamp, meta.requestId, etc.
mockifyer-drift-check --ignore-path meta
```

## Programmatic API

Use drift check in your own scripts:

```typescript
import { checkDrift } from '@sgedda/mockifyer-core/utils/drift';

const report = await checkDrift({
  scenario: 'production',
  mockDataPath: './mock-data',
  driftOptions: {
    baseUrl: 'https://api.example.com',
    headers: {
      'Authorization': `Bearer ${process.env.API_TOKEN}`,
    },
    ignorePaths: ['timestamp', 'meta.requestId'],
    failOnWarnings: false,
  },
});

console.log(report.summary);

if (report.breakingDriftCount > 0) {
  console.error('Breaking changes detected!');
  process.exit(1);
}
```

## Security Notes

- **Values are never logged:** Drift reports include only paths and types, never actual values (prevents secret leakage).
- **Auth headers from env:** Pass tokens via environment variables, not command-line args (which are visible in process lists).
- **Non-prod URLs:** Always check against staging/test environments, not production (drift check makes real HTTP requests).
- **Rate limiting:** Use `--delay` to throttle requests (default 100ms between batches).

## Safe Methods

By default, drift check only tests **GET** requests (safe, read-only).

To check **POST/PUT/DELETE**, use `--allow-unsafe-methods`:

```bash
mockifyer-drift-check --allow-unsafe-methods
```

⚠️ **Warning:** Unsafe methods may modify data on the live API. Only use this flag against test/staging environments.

## Troubleshooting

### "No mocks found"

- Check that `mock-data/<scenario>/` exists and contains `.json` files
- Verify mocks have `request` and `response` fields
- Try `--mock-data-path` to override auto-detection

### "Scenario path not found"

- Create the scenario first: record some mocks with that scenario name
- Check spelling (scenario names are case-sensitive)

### Network errors / timeouts

- Verify the API is reachable: `curl <url>`
- Increase timeout: `--timeout 30000` (30 seconds)
- Check for auth errors (401/403): pass `--header "Authorization: ..."`
- If an endpoint is unreachable, it's reported as "skipped" (doesn't fail the run)

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No drift detected (or warnings only without `--fail-on-warnings`) |
| `1` | Breaking drift detected (or any drift with `--fail-on-warnings`) |
| `2` | Error (invalid arguments, no mocks found, etc.) |

## FAQ

**Q: Does this replace contract testing (Pact)?**  
A: No. Drift check is simpler—it compares structure only. Pact is for consumer-driven contracts with provider verification.

**Q: Why only shape, not values?**  
A: Value comparison is noisy (timestamps, IDs, pagination). Shape changes (missing keys, type changes) are what break apps.

**Q: Can I check multiple scenarios at once?**  
A: Not yet. Run drift check once per scenario, or loop over scenarios in your CI script.

**Q: How do I update mocks after drift is detected?**  
A: Review the drift report, then re-record the affected mocks in Mockifyer's record mode. Or manually edit the mock JSON if the change is expected.

**Q: Does it work with GraphQL?**  
A: Yes, GraphQL responses are JSON. Drift check compares the `data` and `errors` fields like any other endpoint.

## Related

- [Contract Drift Detection Plan](../.cursor/plans/contract-drift-detection.md) — Full design doc
- [Mock Workflow](../MOCK_WORKFLOW.md) — How to manage mocks in teams
- [Main README](../README.md) — Mockifyer overview
