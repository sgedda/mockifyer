---
name: Dashboard network log
overview: Add a sustainable “Network” view in the dashboard by capturing Mockifyer SDK traffic into a bounded, privacy-aware event log (Redis ring buffer with TTL + in-memory fallback) and rendering it with filters and request detail panes.
todos:
  - id: phase-1-schema-store-routes-proxy
    content: "Phase 1 — NetworkEvent schema + redaction policy; Redis + in-memory network log store; /api/network-events GET/POST/DELETE; proxy.ts emits hit/miss/blocked/error."
    status: pending
  - id: phase-2-network-tab
    content: "Phase 2 — Network view component, Dashboard route/tab, list + filters + detail pane, polling with since cursor."
    status: pending
  - id: phase-3-sdk-emitters
    content: "Phase 3 — Best-effort POST emitters in mockifyer-axios + mockifyer-fetch when dashboard URL configured."
    status: pending
  - id: phase-4-polish
    content: "Phase 4 — Settings toggles (enable/bodies), sampling, optional start/end correlation or HAR-ish export."
    status: pending
---

## Goal
Provide a Chrome DevTools-like Network view inside Mockifyer Dashboard that shows requests made through Mockifyer SDKs (axios/fetch/etc), with a data model and retention strategy that stays fast, bounded, and privacy-conscious.

## What’s already there (we’ll build on)
- The dashboard already has a request-flow UI concept in `Timeline`, built from mock metadata (`packages/mockifyer-dashboard/frontend/src/components/Timeline.tsx`).
- Redis-provider mode already centralizes request visibility through the dashboard proxy (`packages/mockifyer-dashboard/src/routes/proxy.ts`) and Redis store patterns already exist (`RedisMockStore` used across routes like `mocks.ts`, `stats.ts`).

## Phase 1 — Backend + proxy events (first shippable slice)
This **merges** the old “Milestone 1” with the spec sections below: ship a working event pipeline in **Redis-proxy mode** before the Network tab or SDK POST emitters. Tracks YAML todo **`phase-1-schema-store-routes-proxy`**.

| Piece | What to build |
|--------|----------------|
| **Schema** | `NetworkEvent` + redaction/size defaults — full field list under **Event model**; guardrails under **Privacy & performance guardrails** (defaults only). |
| **Store** | Network log abstraction: `append`, `list({ scenario, clientId?, limit, since? })`, `clear` — **Recommended retention** + **Backend plumbing** (Redis ring + TTL; in-memory fallback for filesystem provider). |
| **Routes** | `GET` / `POST` / `DELETE` `/api/network-events` — register in `src/server.ts` (**Backend plumbing**). |
| **Proxy** | `proxy.ts` appends events: Redis hit, upstream miss, blocked, proxy failure (**Backend plumbing** hook list). |

**Deferred to Phase 2–4:** UI (`frontend-network-tab`), SDK sinks (`sdk-emitters`), explicit Settings toggles and advanced sampling/export (`phase-4-polish`).

## Phase 2 — Network tab UI
Tracks **`phase-2-network-tab`**. Implements **Frontend: Network tab UI** — new route/tab in `Dashboard.tsx`, `Network.tsx` with DevTools-style table, filters, detail pane, polling with `since`.

## Phase 3 — SDK integration
Tracks **`phase-3-sdk-emitters`**. Implements **SDK integration** — optional `networkLog` sink / `MOCKIFYER_DASHBOARD_URL`, non-blocking POSTs, `request_start` / `request_end` (or merged server-side).

## Phase 4 — Polish
Tracks **`phase-4-polish`**. Explicit Settings toggles (network logging on/off, body capture), sampling under load, optional waterfall correlation or export.

## Recommended retention (sustainable default)
- **Primary**: **Redis ring buffer + TTL** per scenario (and optionally per client lane).
  - Bounded list size (e.g. 2k–20k events per scenario) + TTL (e.g. 6–24h).
  - Keeps UI snappy and prevents unbounded growth / accidental PII retention.
- **Fallback** (filesystem provider): in-process ring buffer only (last N events), clearly labeled “ephemeral”.

## Event model (single schema for all SDKs)
Define a `NetworkEvent` schema that can be produced by:
- `mockifyer-axios` interceptors (request start/end/error)
- `mockifyer-fetch` client wrapper
- dashboard proxy route (hit/miss/upstream/blocked)

Minimum useful fields:
- `id`, `timestamp`, `scenario`, `clientId` (lane), `sessionId`, `requestId`, `parentRequestId`, `sequence`
- `transport`: `axios | fetch | proxy`
- `method`, `url`, `host`, `path`, `query` (optionally sanitized)
- `status`, `durationMs`, `source`: `mock-hit | mock-miss | upstream | blocked | error`
- **Payload policy** (guardrails):
  - headers: store allowlisted headers (or redact by default)
  - body/response: **off by default**; allow opt-in sampling / size limit + redaction

## Backend plumbing
- Add a small “network log store” abstraction to `packages/mockifyer-dashboard/src/utils/`:
  - Interface: `append(event)`, `list({scenario, clientId?, limit, since?})`, `clear({scenario, clientId?})`
  - Implementations:
    - Redis-backed: list-based ring buffer keys + TTL
    - Memory-backed: simple circular buffer
- Add new routes in `packages/mockifyer-dashboard/src/routes/`:
  - `GET /api/network-events?scenario=&clientId=&limit=&since=`
  - `POST /api/network-events` (append; used by SDKs)
  - `DELETE /api/network-events?scenario=&clientId=` (clear)
- Lane/client ID integrity:
  - Treat `clientId` as a **stable unique key** (no duplicates). Any “lane discovery” or metadata updates must be **idempotent upserts** keyed by `clientId` (e.g. Redis `SET`/`HSET`), not append-only lists.
- Hook the proxy route (`packages/mockifyer-dashboard/src/routes/proxy.ts`) to append a `NetworkEvent` on:
  - redis hit
  - upstream miss
  - upstream blocked
  - proxy failure

## SDK integration (how events reach dashboard)
- Add optional config to SDKs: `networkLog` sink
  - default sink: HTTP POST to dashboard `POST /api/network-events` when `MOCKIFYER_DASHBOARD_URL` (or similar) is configured.
  - ensure this is non-blocking/best-effort (never break request flow).
- For axios/fetch SDKs, emit two events:
  - `request_start` (timestamp, requestId)
  - `request_end` (status, durationMs, outcome)
  - The backend can merge or UI can correlate by requestId.

## Frontend: Network tab UI
- Add a new tab + route alongside existing ones in `packages/mockifyer-dashboard/frontend/src/components/Dashboard.tsx`.
- Create `packages/mockifyer-dashboard/frontend/src/components/Network.tsx`:
  - table/list like DevTools: method, path, status, time, size (if known), source (mock/upstream)
  - filters: text search, method, status, source, client lane, scenario
  - details pane: headers + sanitized request/response previews (if captured)
  - live refresh: polling (simple) with `since` cursor; optionally upgrade to SSE later if needed.

## Privacy & performance guardrails (make it maintainable)
- Hard caps:
  - max events stored per scenario
  - max serialized event bytes
  - optional sampling when volume is high
- Redaction:
  - default redact: `authorization`, `cookie`, `set-cookie`, `x-api-key`, etc.
  - query param anonymization option (align with existing `generateRequestKey` behavior)
- Explicit toggles in Settings (Phase 4):
  - enable/disable network logging (**default: enabled / recording ON per scenario**)
  - capture bodies (off by default)
  - per-scenario or global

## Test plan
- Unit tests for network log store (ring behavior, TTL setup, size caps, redaction).
- Basic integration test for `/api/network-events` routes.
- Manual: generate requests via SDK, confirm they appear in Network tab with correct scenario/lane and filtering.
