# Ultimate Mockifyer Trips Showcase

> Plan of record for the example app. Cursor plan file: artifacts `trips_showcase_project_*.plan.md`.

## Prerequisite

**`$pool` serve-time refs are in place** — [PR #281](https://github.com/sgedda/mockifyer/pull/281), docs [`packages/mockifyer-core/docs/POOL_REFS.md`](../../packages/mockifyer-core/docs/POOL_REFS.md). Showcase must **consume** promote + `$pool` (document mode + field select), not copy trip JSON per scenario. Endpoint slots / `$entity` stay deferred.

## Headline demo loop

1. Promote `trips-list-alice` from default recordings  
2. Scenarios (`default`, `check-in-open`, …) set `$pool` refs on the trips mock  
3. Scenario overlays for check-in dates/status  
4. Client lanes + Playwright + Network traces + MCP prompts  

## Stack

React web (Vite) · Express multi-service BFF chain · Redis dashboard proxy · Playwright · restoreable tutorial.

## Remaining product gap for MCP tutorial

`mockifyer_set_scenario` / `create_scenario` / `set_client_lane_scenario` (pool preview/set already shipped in #281).

## Location

`example-projects/trips-showcase/`
