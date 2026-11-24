# @sgedda/mockifyer-mcp

MCP server that exposes Mockifyer dashboard APIs to AI clients (Cursor, Claude Desktop, and other MCP hosts).

Requires a running [Mockifyer dashboard](https://www.npmjs.com/package/@sgedda/mockifyer-dashboard) (default `http://localhost:3002`).

## Quick start

```bash
# Terminal 1 — dashboard
npx @sgedda/mockifyer-dashboard --path ./mock-data

# Terminal 2 — MCP (stdio; used by your IDE)
npx @sgedda/mockifyer-mcp
```

## Cursor

Add to `.cursor/mcp.json` (project) or your global MCP settings:

```json
{
  "mcpServers": {
    "mockifyer": {
      "command": "npx",
      "args": ["@sgedda/mockifyer-mcp"],
      "env": {
        "MOCKIFYER_DASHBOARD_URL": "http://localhost:3002"
      }
    }
  }
}
```

## Claude Desktop

Add under `mcpServers` in Claude Desktop’s config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mockifyer": {
      "command": "npx",
      "args": ["@sgedda/mockifyer-mcp"],
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

## Monorepo / from source

```bash
cd packages/mockifyer-mcp
npm install
npm run build
```

Then point your MCP client at `dist/cli.js` instead of `npx`.

## Publish (maintainers)

Push a tag matching the package version (does not run until you push the tag):

```bash
git tag mcp-v0.1.5
git push origin mcp-v0.1.5
```

That triggers `.github/workflows/npm-publish.yml` for `@sgedda/mockifyer-mcp`.

MCP Registry: after npm has the package, publish metadata from this directory with the [MCP publisher](https://modelcontextprotocol.io/registry/quickstart) using [server.json](./server.json) (`mcpName` in `package.json` must match `server.json` `name`).

## Tools

| Tool | Description |
|------|-------------|
| `mockifyer_get_mock_ai_context` | **Lightweight** mock projection for AI (fields, schema, state hints) |
| `mockifyer_set_field_overrides` | Replay-time path/value overlays (no full body) |
| `mockifyer_get_field_overrides` | Read field overrides for a mock |
| `mockifyer_list_override_groups` | List groups + default/lane/effective selection |
| `mockifyer_set_active_override_group` | Set lane or scenario-default active group |
| `mockifyer_put_override_group` | Create/replace an override group |
| `mockifyer_upsert_override_group_entry` | Set/clear field overlays for one mock in a group |
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
| `mockifyer_explain_incident` | Crash / incident context with preceding hops and heuristic suspects |
| `mockifyer_explain_value` | **One-call answer**: where a value comes from (mock file, overrides, trace, siblings) |
| `mockifyer_get_network_log_config` | Whether network logging and body capture are enabled |
| `mockifyer_get_atlas_doc` | Atlas screen/CMS/datasource map (summary by default) |
| `mockifyer_list_atlas_events` | Live prefetch/presentation events |
| `mockifyer_list_atlas_usage` | requestId → screen/component annotations |
| `mockifyer_list_atlas_sessions` / `mockifyer_get_atlas_tree` | Sessions + CMS tree |
| `mockifyer_get_atlas_generated_status` | Whether `atlas-html` generate output exists |
| `mockifyer_list_atlas_generated_hops` | Hops from `atlas-events.json` after generate |
| `mockifyer_search_atlas_bodies` / `mockifyer_get_atlas_hop_body` | Search/read `bodies-search.json` (+ spills) |
| `mockifyer_list_entities` | List fixture-pool entities (filter by type/tag) |
| `mockifyer_get_entity` / `mockifyer_create_entity` / `mockifyer_delete_entity` | Entity CRUD |
| `mockifyer_extract_entity` | Extract from a mock (`jsonPath`, optional all array items) |
| `mockifyer_fork_entity` | Copy entity to a new id |
| `mockifyer_promote_response` / `mockifyer_list_response_fixtures` | Full-response fixtures |
| `mockifyer_preview_pool_ref` | Preview `$pool` resolve (path + field/index select) |
| `mockifyer_set_pool_ref` | Embed `$pool` into a scenario mock response |

## Example (IDE chat)

> "What fields drive order status in scenario `default`?"

The assistant can call:

1. `mockifyer_search_mocks({ q: "orders", scenario: "default" })`
2. `mockifyer_get_mock_ai_context({ filename: "...", mode: "profile" })`
3. `mockifyer_set_field_overrides({ filename, overrides: [{ path: "bookings.0.status", value: "CONFIRMED" }] })`

> "Why does the screen show temperature = -999?"

1. `mockifyer_explain_value({ scenario: "default", url: "/api/weather", fieldPath: "temperature_2m" })`

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `MOCKIFYER_DASHBOARD_URL` | `http://localhost:3002` | Dashboard origin |
| `MOCKIFYER_DASHBOARD_BASE` | `` | URL mount prefix (e.g. `/dashboard`) |
| `MOCKIFYER_DASHBOARD_AUTH_USER` | — | Basic auth user |
| `MOCKIFYER_DASHBOARD_AUTH_PASSWORD` | — | Basic auth password |

## Links

- Homepage: [mockifyer.dev](https://mockifyer.dev)
- AI summary: [llms.txt](https://mockifyer.dev/llms.txt)
- Source: [packages/mockifyer-mcp](https://github.com/sgedda/mockifyer/tree/main/packages/mockifyer-mcp)
