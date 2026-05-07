---
name: Dashboard network log
overview: Add a sustainable “Network” view in the dashboard by capturing Mockifyer SDK traffic into a bounded, privacy-aware event log (Redis ring buffer with TTL + in-memory fallback) and rendering it with filters and request detail panes.
todos:
  - id: event-schema
    content: Define `NetworkEvent` schema + redaction/size policy (shared between dashboard backend and frontend types).
    status: pending
  - id: backend-store
    content: Implement Redis + in-memory network log store abstraction in dashboard backend.
    status: pending
  - id: backend-routes
    content: Add `/api/network-events` GET/POST/DELETE routes and register in `src/server.ts`.
    status: pending
  - id: proxy-emit
    content: Append `NetworkEvent`s from `src/routes/proxy.ts` for hit/miss/blocked/error.
    status: pending
  - id: frontend-network-tab
    content: Add a `Network` view component + route/tab wiring in dashboard UI.
    status: pending
  - id: sdk-emitters
    content: Add best-effort network logging emitters to `mockifyer-axios` and `mockifyer-fetch` (configurable dashboard URL).
    status: pending
---

## Goal
Provide a Chrome DevTools-like Network view inside Mockifyer Dashboard that shows requests made through Mockifyer SDKs (axios/fetch/etc), with a data model and retention strategy that stays fast, bounded, and privacy-conscious.

## What’s already there (we’ll build on)
- The dashboard already has a request-flow UI concept in `Timeline`, built from mock metadata (`packages/mockifyer-dashboard/frontend/src/components/Timeline.tsx`).
- Redis-provider mode already centralizes request visibility through the dashboard proxy (`packages/mockifyer-dashboard/src/routes/proxy.ts`) and Redis store patterns already exist (`RedisMockStore` used across routes like `mocks.ts`, `stats.ts`).

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
- Explicit toggles in Settings:
  - enable/disable network logging (**default: enabled / recording ON per scenario**)
  - capture bodies (off by default)
  - per-scenario or global

## Test plan
- Unit tests for network log store (ring behavior, TTL setup, size caps, redaction).
- Basic integration test for `/api/network-events` routes.
- Manual: generate requests via SDK, confirm they appear in Network tab with correct scenario/lane and filtering.

## Milestones (smallest useful first)
1. Backend event store + routes + proxy emits events (immediately useful in Redis-proxy mode).
2. Network tab UI showing events with filtering + detail pane.
3. SDK emitters (axios + fetch) posting to dashboard when configured.
4. Optional: correlate start/end events for waterfall/timing, export (HAR-ish) if requested later.

