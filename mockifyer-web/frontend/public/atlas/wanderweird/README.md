# WanderWeird Atlas (marketing showcase)

Static, scrubbed Atlas HTML generated from **real** WanderWeird E2E traffic
(`observedRequests > 0`), not a code-only scan. Light mode only.

## Files

| File | Role |
|------|------|
| `index.html` | Interactive Atlas (events embedded) |
| `bodies-search.json` | Payload search corpus (fetched at runtime) |
| `preview.jpg` | Cropped overview + diagram for the home page |
| `manifest.json` | Provenance + endpoint/request counts |

Served at `/atlas/wanderweird/` on mockifyer-web.

## Regenerate

From the repo root (does **not** run in CI automatically):

```bash
# Preferred: after a local e2e run that wrote e2e/atlas-report/
cd e2e && npm test
node mockifyer-web/scripts/sync-wanderweird-atlas.mjs

# Or pull the latest GitHub Actions artifact (same pipeline as Pages /atlas/)
node mockifyer-web/scripts/sync-wanderweird-atlas.mjs --from-artifact
```

Requires `gh` for `--from-artifact`, and Playwright in `mockifyer-web` for `preview.jpg`.

The sync script refuses sources with zero observed requests.
