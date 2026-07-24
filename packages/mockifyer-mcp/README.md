# Mockifyer MCP Server

MCP server that exposes Mockifyer dashboard APIs to AI clients (Cursor, Claude Desktop, etc.).

## Prerequisites

The [Mockifyer dashboard](../mockifyer-dashboard) must be running:

```bash
npx mockifyer-dashboard --path ./mock-data
# default: http://localhost:3002
```

## Install & build

```bash
cd packages/mockifyer-mcp
npm install
npm run build
```

## Cursor configuration

Add to `.cursor/mcp.json` (project) or global MCP settings:

```json
{
  "mcpServers": {
    "mockifyer": {
      "command": "node",
      "args": ["/Users/you/git/mockifyer/packages/mockifyer-mcp/dist/cli.js"],
      "env": {
        "MOCKIFYER_DASHBOARD_URL": "http://localhost:3002"
      }
    }
  }
}
```

If the dashboard is mounted under a prefix (e.g. `/dashboard`):

```json
"env": {
  "MOCKIFYER_DASHBOARD_URL": "http://localhost:3002",
  "MOCKIFYER_DASHBOARD_BASE": "/dashboard"
}
```

Optional HTTP Basic Auth (when enabled on the dashboard host):

```json
"env": {
  "MOCKIFYER_DASHBOARD_AUTH_USER": "admin",
  "MOCKIFYER_DASHBOARD_AUTH_PASSWORD": "secret"
}
```

See [mcp-config.example.json](./mcp-config.example.json).

## Tools

| Tool | Description |
|------|-------------|
| `mockifyer_get_mock_ai_context` | **Lightweight** mock projection for AI (fields, schema, state hints) |
| `mockifyer_set_field_overrides` | Replay-time path/value overlays (no full body) |
| `mockifyer_copy_array_item` | Clone array item + optional overrides (persisted) |
| `mockifyer_list_mocks` | List recordings in a scenario |
| `mockifyer_search_mocks` | Search by filename / endpoint / method |
| `mockifyer_get_mock` | Full mock JSON (large — prefer ai_context when possible) |
| `mockifyer_list_scenarios` | Available and active scenarios |
| `mockifyer_set_scenario` | Switch the dashboard active/global scenario |
| `mockifyer_create_scenario` | Create a scenario (`deriveFrom` copies mocks from another) |
| `mockifyer_list_client_lanes` | Redis/sqlite client lanes + configured scenarios |
| `mockifyer_set_client_lane_scenario` | Bind a `MOCKIFYER_CLIENT_ID` lane to a scenario |
| `mockifyer_get_endpoint_stats` | Endpoint / status / method aggregates |
| `mockifyer_list_network_events` | Recent network log hops (find `requestId` / `eventId`) |
| `mockifyer_get_network_trace` | Multi-service call chain with optional body previews |
| `mockifyer_get_network_log_config` | Whether network logging and body capture are enabled |
| `mockifyer_list_entities` | List fixture-pool entities (filter by type/tag) |
| `mockifyer_get_entity` / `mockifyer_create_entity` / `mockifyer_delete_entity` | Entity CRUD |
| `mockifyer_extract_entity` | Extract from a mock (`jsonPath`, optional all array items) |
| `mockifyer_fork_entity` | Copy entity to a new id |
| `mockifyer_promote_response` / `mockifyer_list_response_fixtures` | Full-response fixtures |
| `mockifyer_preview_pool_ref` | Preview `$pool` resolve (path + field/index select) |
| `mockifyer_set_pool_ref` | Embed `$pool` into a scenario mock response |

Endpoint **slots** are deferred. **`$pool` refs** activate promoted response fixtures at serve time (see `packages/mockifyer-core/docs/POOL_REFS.md`). Entities remain a shared catalog for extract/browse.

## Example (IDE chat)

> "What fields drive order status in scenario `default`?"

The assistant can call:

1. `mockifyer_search_mocks({ q: "orders", scenario: "default" })`
2. `mockifyer_get_mock_ai_context({ filename: "...", mode: "profile" })`
3. `mockifyer_set_field_overrides({ filename, overrides: [{ path: "bookings.0.status", value: "CONFIRMED" }] })`
   or `mockifyer_copy_array_item({ filename, arrayPath: "bookings", fromIndex: 0, itemOverrides: { status: "CONFIRMED" } })`

> "Use pool response `trips-list-alice` in scenario `check-in-open`, keep the envelope, only trips nyc + rome."

1. `mockifyer_preview_pool_ref({ id: "trips-list-alice", mode: "document", path: "trips", select: { field: "id", values: ["trip-nyc", "trip-rome"] } })`
2. `mockifyer_set_pool_ref({ scenario: "check-in-open", filename: "…", pool: { id: "trips-list-alice", mode: "document", path: "trips", select: { field: "id", values: ["trip-nyc", "trip-rome"] } } })`

> "Trace the gateway call that returned 502 — what did each hop use?"

1. `mockifyer_list_network_events({ scenario: "default", limit: 50 })` — pick `requestId` or `eventId`
2. `mockifyer_get_network_trace({ requestId: "...", scenario: "default" })` — ordered `trace.hops[]` root-first

Requires network logging enabled in the dashboard Network tab (persistent with `redis` / `sqlite` providers).

> "Create `check-in-open` from `default`, then point Playwright lane `trips-e2e-checkin` at it"

1. `mockifyer_create_scenario({ scenario: "check-in-open", deriveFrom: "default" })`
2. Apply `$pool` / field overrides on the new scenario mocks
3. `mockifyer_set_client_lane_scenario({ clientId: "trips-e2e-checkin", scenario: "check-in-open" })`

Use `mockifyer_set_scenario` only for the global/active scenario; prefer lane mapping for isolated E2E runs.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `MOCKIFYER_DASHBOARD_URL` | `http://localhost:3002` | Dashboard origin |
| `MOCKIFYER_DASHBOARD_BASE` | `` | URL mount prefix (e.g. `/dashboard`) |
| `MOCKIFYER_DASHBOARD_AUTH_USER` | — | Basic auth user |
| `MOCKIFYER_DASHBOARD_AUTH_PASSWORD` | — | Basic auth password |
