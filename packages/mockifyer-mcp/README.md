# Mockifyer MCP Server

MCP server that exposes Mockifyer dashboard APIs to AI clients (Cursor, Claude Desktop, etc.).

## Prerequisites

The [Mockifyer dashboard](../mockifyer-dashboard) must be running:

```bash
npx mockifyer-dashboard --path ./mock-data
# default: http://localhost:3002
```

## How it works

`@sgedda/mockifyer-mcp` is a stdio MCP server that sits between your AI client and a running Mockifyer dashboard:

1. The dashboard reads your local `mock-data` directory and exposes the same APIs used by the dashboard UI.
2. Cursor, Claude Desktop, or another MCP client starts this package with `MOCKIFYER_DASHBOARD_URL` pointing at the dashboard.
3. The assistant calls typed MCP tools to list scenarios, search recordings, fetch lightweight AI context, and apply small mock edits.

The MCP server does not replace the dashboard or intercept HTTP traffic directly. It delegates to the dashboard API, so it works with the same scenarios, filesystem mocks, Redis lanes, auth settings, and mounted base path that the dashboard already uses.

## Why it is useful

- **Less context noise:** `mockifyer_get_mock_ai_context` returns fields, schema summaries, and state hints without sending full response bodies to the AI.
- **Safer edits:** field overrides and array-item copies are small, targeted operations instead of full-file rewrites.
- **Faster discovery:** assistants can search by endpoint, method, filename, or scenario without guessing how recordings are named.
- **Better debugging:** endpoint stats, related mocks, and scenario lists help explain test-data drift and missing coverage.

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
| `mockifyer_get_endpoint_stats` | Endpoint / status / method aggregates |
| `mockifyer_list_network_events` | Recent network log hops (find `requestId` / `eventId`) |
| `mockifyer_get_network_trace` | Multi-service call chain with optional body previews |
| `mockifyer_get_network_log_config` | Whether network logging and body capture are enabled |
| `mockifyer_list_entities` | List fixture-pool entities (filter by type/tag) |
| `mockifyer_get_entity` / `mockifyer_create_entity` / `mockifyer_delete_entity` | Entity CRUD |
| `mockifyer_extract_entity` | Extract from a mock (`jsonPath`, optional all array items) |
| `mockifyer_fork_entity` | Copy entity to a new id |
| `mockifyer_promote_response` / `mockifyer_list_response_fixtures` | Full-response fixtures |

Endpoint **slots** are deferred — pool items are a shared catalog; scenarios still serve via normal mock files.

## Example (IDE chat)

> "What fields drive order status in scenario `default`?"

The assistant can call:

1. `mockifyer_search_mocks({ q: "orders", scenario: "default" })`
2. `mockifyer_get_mock_ai_context({ filename: "...", mode: "profile" })`
3. `mockifyer_set_field_overrides({ filename, overrides: [{ path: "bookings.0.status", value: "CONFIRMED" }] })`
   or `mockifyer_copy_array_item({ filename, arrayPath: "bookings", fromIndex: 0, itemOverrides: { status: "CONFIRMED" } })`

> "Trace the gateway call that returned 502 — what did each hop use?"

1. `mockifyer_list_network_events({ scenario: "default", limit: 50 })` — pick `requestId` or `eventId`
2. `mockifyer_get_network_trace({ requestId: "...", scenario: "default" })` — ordered `trace.hops[]` root-first

Requires network logging enabled in the dashboard Network tab (persistent with `redis` / `sqlite` providers).

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `MOCKIFYER_DASHBOARD_URL` | `http://localhost:3002` | Dashboard origin |
| `MOCKIFYER_DASHBOARD_BASE` | `` | URL mount prefix (e.g. `/dashboard`) |
| `MOCKIFYER_DASHBOARD_AUTH_USER` | — | Basic auth user |
| `MOCKIFYER_DASHBOARD_AUTH_PASSWORD` | — | Basic auth password |
