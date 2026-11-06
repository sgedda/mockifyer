# Demo helpers for the Wanderweird guide

Small scripts used to record the guide's GIFs. They are **not** part of Mockifyer core — they are **convenience wrappers** around Mockifyer dashboard APIs and MCP tools. Each script header documents which Mockifyer API endpoint or MCP tool it calls.

## Location

These scripts live at `docs/guides/wanderweird-demo-scripts/` in the Mockifyer repository, next to the [wanderweird-demo.md](../wanderweird-demo.md) guide.

## Usage

Run the scripts from anywhere inside the Mockifyer monorepo checkout (they auto-detect the repo root via `git rev-parse --show-toplevel`).

```bash
# From the repo root
./docs/guides/wanderweird-demo-scripts/start-stack.sh

# Or from inside wanderweird
cd example-projects/wanderweird-travel
../../docs/guides/wanderweird-demo-scripts/scenario-setup.sh
```

## Configuration

Optional environment variables (all have sensible defaults):

- `MOCKIFYER_DASHBOARD_URL` (default: `http://127.0.0.1:3002`)
- `SCENARIO` (default: `guide-demo-2`)
- `MOCKIFYER_REPO` (default: auto-detected via `git rev-parse --show-toplevel`)
- `GATEWAY_URL` (default: `http://127.0.0.1:4200`)

## Agent scripts

The `agent/` scripts require `cursor-agent` CLI and `CURSOR_API_KEY` in your environment. No keys are stored in this repository.

## Recording helpers (optional)

The `recording/` subfolder contains:
- `recording/sbs/*.html` — side-by-side iframe pages for GIF recording (app + dashboard, two iframes)
- `recording/rec/scenarios-drive.py` — Playwright script that drove the scenario-switching recording

These are **optional** and were only used to record the guide's GIFs. You don't need them to follow the guide.

## Scenario switching (guide section 4.14)

- `scenario-setup.sh`: creates `heatwave` and `rainy-weekend` from `guide-demo-2` and edits the Athens forecast in each
- `wander-follow-lane.sh`: restarts wander-api without `MOCKIFYER_SCENARIO` so it follows its client lane (`PIN=guide-demo-2` pins it again)
- `scenario-switch.sh <scenario>`: sets the `wanderweird-demo` lane and prints what Discover now returns
- `recording/sbs/scenarios.html` + `recording/rec/scenarios-drive.py`: the side-by-side page and the Playwright driver used to record the clip

## What the scripts assume

The scripts expect the WanderWeird example structure at `example-projects/wanderweird-travel/` with services on the documented ports:
- Dashboard: `:3002`
- Gateway: `:4200`
- Services: `:4201–4206` (auth, trips, wander, cms, lore, graphql)
- Second client (teammate-b): wander `:4213`, graphql `:4216`
- Expo web app: `:8090`

These match the WanderWeird README and the guide.
