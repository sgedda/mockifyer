# Scenario import and export

The Mockifyer dashboard can back up and restore an entire **scenario** (all recorded mocks for that scenario, plus optional per-scenario settings) as a single JSON file. This is useful for sharing setups between machines, CI fixtures, or disaster recovery.

## Where to use it

In the dashboard UI: **Settings → Import / export scenario**.

You can also call the HTTP API directly (same host as the dashboard, under `/api`).

## Export

### UI

1. Choose the scenario in **Export scenario**.
2. Click **Download JSON**. The browser saves a file such as `mockifyer-scenario-my-scenario-2026-05-12.json`.

### API

`GET /api/scenario-config/export?scenario=<name>`

- Omit `scenario` to export the **currently active** scenario (from `scenario-config.json` or Redis active scenario, depending on how the dashboard is configured).

**Response:** JSON object (the “bundle”) with:

| Field | Meaning |
| --- | --- |
| `formatVersion` | Always `1` for this document. |
| `exportedAt` | ISO timestamp when the export was generated. |
| `sourceScenario` | Scenario name that was exported. |
| `dashboardProvider` | `filesystem`, `sqlite`, or `redis` — informational only. |
| `mocks` | Array of `{ "relativePath": "...", "data": { ... } }` entries. Each `data` is a full Mockifyer mock document (`request`, `response`, `timestamp`, etc.). |
| `dateManipulation` | Effective date override for that scenario, or `null` if none. |
| `proxyConfig` | `{ recordOnMiss, allowUpstream }` when the dashboard uses Redis and values exist; otherwise `null` (filesystem-only dashboards do not store proxy config in this bundle). |

**Filesystem / sqlite:** mock files are read recursively from the scenario folder. `date-config.json` in that folder is **not** included as a mock; its effect is merged into `dateManipulation` (including legacy fallback to a root `date-config.json` when no per-scenario file exists).

**Redis:** mocks are read from the Redis index for that scenario; date and proxy settings come from the same Redis keys the dashboard uses elsewhere.

## Import

### UI

1. Click **Choose file…** and pick a bundle JSON (from an export or hand-built with `formatVersion: 1`).
2. Set **Target scenario name** (defaults to `sourceScenario` from the file when present).
3. Options:
   - **Replace existing mocks** — removes all mock entries for the target scenario before writing (filesystem: deletes `.json` mocks under the scenario folder except `date-config.json`; Redis: clears the scenario index). Then every mock in the file is written.
   - **Apply date settings from file** — only runs if the JSON actually contains a `dateManipulation` field. If unchecked, existing date behavior for the target scenario is left unchanged.
   - **Apply proxy settings from file** — only applies when the bundle includes `proxyConfig` **and** the dashboard runs with the Redis provider (same as the Proxy settings UI).
4. Click **Import into scenario**.

If the target scenario does not exist yet, the server creates an empty scenario first (same idea as **Create New Scenario**), then applies the bundle.

### API

`POST /api/scenario-config/import`

**Content-Type:** `application/json`

The body can be either:

1. **Flat:** the export object plus control fields on the same object, or  
2. **Wrapped:** `{ "bundle": { ...export }, "targetScenario": "...", ... }`

Control fields (optional unless noted):

| Field | Default | Meaning |
| --- | --- | --- |
| `targetScenario` | `sourceScenario` from bundle | Scenario to write into (letters, numbers, `-`, `_` only). |
| `replaceExistingMocks` | `false` | When `true`, clear mocks in the target before import. |
| `applyDateConfig` | `true` | When `false`, skip updating date manipulation even if the bundle has `dateManipulation`. |
| `applyProxyConfig` | `true` | When `false`, skip proxy updates even if the bundle has `proxyConfig`. |

**Success response** (abridged):

```json
{
  "success": true,
  "message": "Imported 42 mock(s) into \"my-scenario\"",
  "targetScenario": "my-scenario",
  "scenarios": ["default", "my-scenario"],
  "mocksWritten": 42,
  "dateConfigApplied": true,
  "proxyConfigApplied": false
}
```

**Errors:** `400` for validation issues (bad `formatVersion`, invalid paths, etc.); `500` for unexpected server errors. The JSON body includes `error` and often `details`.

## Merge vs replace

- **`replaceExistingMocks: false` (default):** Existing mocks are not bulk-deleted. Each entry in `mocks` is written to its `relativePath` under the target scenario (filesystem) or by hash (Redis). Same path or hash as an existing mock **overwrites** that mock.
- **`replaceExistingMocks: true`:** All mocks for the target scenario are removed first, then the bundle’s mocks are written. Use this when you want the target scenario to match the file exactly.

Date and proxy behavior follow the `applyDateConfig` / `applyProxyConfig` flags and whether the corresponding keys exist in the JSON.

## Paths and Redis

- **Filesystem:** `relativePath` is relative to the scenario directory (POSIX slashes). Paths are validated so imports cannot escape outside the scenario folder.
- **Redis:** Exports use synthetic paths `redis/<64-hex>.json` where the hex is the content hash. On import, that hash is reused when the path matches; otherwise a hash is derived from the mock payload so imports from filesystem-style bundles still work.

## Versioning

Only `formatVersion: 1` is supported today. Future versions may add fields; clients should preserve unknown fields if re-exporting.
