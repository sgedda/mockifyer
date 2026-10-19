# Pool `$pool` refs (response-centric activation)

Promoted fixture-pool **responses** can be referenced from scenario mocks at serve time. Endpoint **slots** remain deferred; `$pool` is the v1 activation path.

## Flow

1. **Promote** a recording into the pool (`POST /api/fixture-pool/responses/promote` or `mockifyer_promote_response`).
2. **Embed** a `$pool` node in a scenario mock’s `response.data` (dashboard `PATCH …/pool-ref` or `mockifyer_set_pool_ref`).
3. On mock hit, Mockifyer **resolves** the ref (loads the pool fixture, applies path/select), then applies scenario field/date overrides.

## Ref shape

```json
{
  "$pool": {
    "id": "trips-list-alice",
    "mode": "document",
    "path": "trips",
    "select": {
      "field": "id",
      "values": ["trip-nyc-checkin", "trip-rome-spring"]
    }
  }
}
```

| Field | Meaning |
|-------|---------|
| `id` | Pool response fixture id |
| `mode` | `document` (default): keep full body, filter only at `path`. `value`: replace the `$pool` node with the selected subtree |
| `path` | Dot path into the pool body (optional) |
| `select` | Pick array items by field equality (order follows `values`) |
| `indices` | Pick by position (mutually exclusive with `select`) |

## Env

- `MOCKIFYER_POOL_REFS=false` — skip resolve (debug; raw `$pool` nodes may be returned).

## Preview

```bash
curl -s -X POST http://localhost:3002/api/fixture-pool/responses/trips-list-alice/resolve \
  -H 'Content-Type: application/json' \
  -d '{"mode":"document","path":"trips","select":{"field":"id","values":["trip-nyc-checkin"]}}'
```

## MCP

- `mockifyer_preview_pool_ref` — preview resolve
- `mockifyer_set_pool_ref` — write `$pool` into a scenario mock
