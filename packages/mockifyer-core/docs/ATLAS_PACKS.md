# Atlas packs (live overlays + pins)

Named **packs** shape live (or stored) API responses without a full mock scenario tree.

## When to use

- Pick which trips/bookings belong to a demo user
- Override dates/status on those rows
- Switch stories in-app (`check-in-open` vs `award-trip`) while still calling real backends
- Keep a **pin** (last-good item) so selected ids survive if the backend drops them

Prefer packs over mock scenarios when you only need selection + a few field/date patches.

## Pack shape

```json
{
  "id": "check-in-open",
  "label": "Check-in open",
  "updatedAt": "2026-09-08T12:00:00.000Z",
  "overlays": [
    {
      "datasourceId": "trips-list",
      "operation": "GetTrips",
      "path": "trips",
      "select": { "field": "id", "values": ["trip-nyc", "trip-rome"] },
      "fieldOverrides": [{ "path": "status", "value": "CHECK_IN_OPEN" }],
      "dateOverrides": [{ "path": "checkInOpensAt", "offsetDays": -1 }],
      "pins": [
        { "id": "trip-rome", "data": { "id": "trip-rome", "status": "SCHEDULED" } }
      ]
    }
  ]
}
```

Serve path: **live/stored body → match overlay by `datasourceId` or GraphQL `operationName` → select/merge pins → item field/date overrides**.

Pins refresh automatically when a selected id is present live.

## Storage

| Location | Path |
|----------|------|
| Dashboard filesystem | `{mockDataPath}/_atlas/packs/<id>.json` |
| Active pack | `{mockDataPath}/_atlas/pack-config.json` |
| In-process | `registerAtlasPacks` / `setActiveAtlasPack` / env `MOCKIFYER_ATLAS_PACK` |
| Built app | import bundled JSON → `registerAtlasPacks` |

## Dashboard API

- `GET /api/atlas/packs`
- `GET /api/atlas/packs/:id`
- `PUT /api/atlas/packs/:id`
- `DELETE /api/atlas/packs/:id`
- `POST /api/atlas/packs/set` body `{ "pack": "check-in-open" | null }`

## Runtime (SDK)

```ts
import {
  registerAtlasPacks,
  setActiveAtlasPack,
  applyActiveAtlasPackToData,
} from '@sgedda/mockifyer-core';

registerAtlasPacks([packFromJson]);
setActiveAtlasPack('check-in-open');
// fetch/axios/proxy apply overlays on responses automatically when active
```

MCP: `mockifyer_list_atlas_packs`, `mockifyer_get_atlas_pack`, `mockifyer_upsert_atlas_pack`, `mockifyer_set_atlas_pack`, `mockifyer_delete_atlas_pack`.
