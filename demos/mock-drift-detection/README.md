# Mockifyer: Mock Drift Detection

This demo shows how Mockifyer detects when your mocks drift from the real API.

**Note:** This demo uses `demo.devxtools.dev` (a third-party public demo API) for demonstration purposes.

## The Problem

Your mocks were recorded 6 months ago. The API has changed:
- New fields were added
- Old fields were removed
- Data shapes evolved

Your tests still pass, but they're testing against **stale data**.

## How Mockifyer Helps

1. **Re-record periodically** to keep mocks fresh
2. **Git diff** mock files to see what changed
3. **Compare** old vs new response shapes
4. **Update tests** when drift is detected

## Try it

Run the tests to see drift detection in action:

```bash
npm test
```

The test compares two mock versions and detects field differences.

## What's inside

- `mock-data/default/`: Original recorded response (tasks API v1)
- `mock-data/updated/`: Updated response after API change (tasks API v2)
- `drift.test.js`: Detects differences between versions

## Key takeaway

**Mockifyer doesn't prevent drift—it makes drift visible.** Re-record regularly, commit mock files, and review diffs in PRs.
