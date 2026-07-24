# Pool `$pool` resolve (response-centric refs)

> **Status (2026-07-23): Shipped** — [PR #281](https://github.com/sgedda/mockifyer/pull/281) (draft). User doc: [`packages/mockifyer-core/docs/POOL_REFS.md`](../../packages/mockifyer-core/docs/POOL_REFS.md). Full plan copy: Cursor artifacts `pool_ref_resolve_*.plan.md`.

Serve-time `$pool` references so scenario mocks resolve promoted `pool/responses/*` by path, with field/index select. `document` mode keeps the envelope; `value` returns the subtree. Endpoint slots remain deferred.

## Shipped surfaces

- Core: `resolve-pool-refs.ts`, `prepareMockResponseBody` resolve-before-overrides
- Fetch / axios / dashboard proxy loaders
- `POST /api/fixture-pool/responses/:id/resolve`
- `PATCH /api/mocks/.../pool-ref`
- MCP: `mockifyer_preview_pool_ref`, `mockifyer_set_pool_ref`
- Env: `MOCKIFYER_POOL_REFS=false` kill-switch

## Follow-ups

- Dashboard mock-editor UI for `$pool`
- Trips showcase tutorial using `$pool` (see trips showcase plan)
