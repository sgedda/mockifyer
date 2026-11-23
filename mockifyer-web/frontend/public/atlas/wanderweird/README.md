# WanderWeird Atlas (marketing showcase)

Static, scrubbed Atlas HTML generated **automatically from a Playwright E2E run** of
the WanderWeird demo (`observedRequests > 0`), not a code-only scan. Light mode only.

## Files

| File | Role |
|------|------|
| `index.html` | Provenance wrapper (banner + how-to link); iframes the interactive Atlas |
| `atlas.html` | Interactive Atlas from e2e teardown (events embedded) |
| `bodies-search.json` | Payload search corpus (fetched by `atlas.html`) |
| `preview.jpg` | Cropped overview + diagram for the home page |
| `manifest.json` | Provenance + endpoint/request counts |

Served at `/atlas/wanderweird/` on mockifyer-web.

## How it was produced

1. Playwright suite runs against WanderWeird with Mockifyer recording (`e2e/`).
2. Traffic lands in the dashboard network log.
3. `e2e/global-teardown.ts` builds `e2e/atlas-report/` via `buildAtlasDocHtmlFiles`.
4. CI uploads `e2e/atlas-report/` as artifact `atlas-architecture` (`.github/workflows/e2e.yml`).

Guide: `/guides/atlas-from-playwright`

## Regenerate

From the repo root (does **not** run in CI automatically):

```bash
# Preferred: after a local e2e run that wrote e2e/atlas-report/
cd e2e && npm test
node mockifyer-web/scripts/sync-wanderweird-atlas.mjs

# Or pull the latest GitHub Actions artifact (same pipeline as Pages /atlas/)
node mockifyer-web/scripts/sync-wanderweird-atlas.mjs --from-artifact
```

Sync writes `atlas.html` + `bodies-search.json` + `preview.jpg` and **preserves** the
provenance wrapper `index.html`. Requires `gh` for `--from-artifact`, and Playwright
in `mockifyer-web` for `preview.jpg`.

The sync script refuses sources with zero observed requests.
