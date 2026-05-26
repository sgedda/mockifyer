# Trace request chains across services (multi-service Mockifyer)

When Mockifyer is enabled on **more than one** process—gateway → catalog → relay, Next.js route handlers calling internal APIs, RN app hitting BFF then backends—it becomes hard to answer: **which outbound call triggered which downstream mock**, **how responses were stitched**, and **where behavior diverged** between record and replay.

This note captures a **product/feature direction**: first-class **request-chain tracing** that ties captures together across layers so teams can see **data flow** and **merge points**, not isolated HTTP pairs.

**Dashboard presentation is central to DevX**: correlation IDs and span metadata alone do not shorten debug loops unless developers can **see the chain**—timeline, forks, merges, and hop-to-mock navigation—in the Mockifyer dashboard without stitching artifacts by hand. Treat **first-class trace UI** as a requirement alongside propagation and storage, not an optional polish phase.

## Goals (what “good” looks like)

1. **Correlated timeline**: One logical user or test action surfaces as a **single trace** spanning services (ordered steps, latency-ish gaps where measurable, fork/join when parallel calls exist).
2. **Merge visibility**: Highlight **aggregation layers**—where one handler combines multiple upstream responses, transforms envelopes, or picks fields—so “why did this composite payload look like X?” is explainable from mocks + code path context (even if code mapping is manual at first).
3. **Replay fidelity debugging**: During replay, quickly spot **which hop** served stale mock data, wrong scenario, or a mismatch vs record (same correlation, wrong body/status).
4. **Works with multiple Mockifyer setups**: Each service may use filesystem mocks, Redis/dashboard lanes, or mixed modes; traces should **compose** without requiring identical storage backends everywhere.
5. **Dashboard-native flow visualization**: The primary win for developer experience is **in-dashboard** exploration of cross-service flows—discover traces from recent traffic or mock hits, scan structure at a glance, and drill into hops—so CLI/export remains supplementary for CI and power users.

## Motivation

- **Isolation hides causality**: Today, recordings are naturally **per service / per mock store**. Developers mentally reconstruct chains from logs or guesswork.
- **Integration tests span hops**: Multi-repo or monorepo examples (e.g. `example-projects/multi-service-example`) benefit from a **cross-cutting story**: “this UI tap → chain route → gateway → catalog” as one narrative.
- **Onboarding**: New contributors learn system boundaries faster when they can **follow data** rather than grep across five terminals.

## Scope sketch

### Core concepts

| Concept | Description |
|--------|-------------|
| **Chain / trace** | Ordered set of HTTP (or GraphQL) operations belonging to one logical operation (correlation). |
| **Span / hop** | One intercepted request/response pair at one Mockifyer boundary, tagged with service identity and scenario/client lane if known. |
| **Merge node** | Optional semantic tag (manual or heuristic): “combined N responses”, “mapped fields”, “error fallback”—exact detection can evolve. |
| **Correlation** | Stable ID propagated across outbound calls (header convention + extraction from incoming requests). |

### Propagation model (direction)

- **Inbound**: Accept correlation from client or edge (`traceparent` / `baggage`, `x-request-id`, `x-mockifyer-trace-id`, or configurable header names).
- **Outbound**: Inject or forward correlation so downstream Mockifyer instances attach spans to the **same** trace.
- **Scenario alignment**: Optionally record **effective scenario** per hop so dashboards can flag “gateway replay used `scenario-a`, catalog used default.”

### UX surfaces (non-prescriptive)

**Dashboard (critical for DevX)**

- Treat the dashboard as the **default place** engineers land when debugging multi-hop behaviour: trace list (filter by scenario, lane, service, time), **waterfall or ordered timeline**, clear **service boundaries** per hop, and **merge / fork** cues where applicable.
- **Entry points**: jump from an existing mock/recording row or lane activity into “open trace”; avoid forcing users to paste opaque IDs unless they choose advanced flows.
- **Reduce cognitive load**: labels that match how teams think (service names, routes), not only raw URLs; shallow summary before raw payloads.

Supporting surfaces:

- **CLI / export**: NDJSON or OpenTelemetry-ish JSON for CI artifacts (“replay produced different chain shape”).
- **Optional**: Minimal inline banner in dev (“Mockifyer trace `abc123` — 4 hops”) that deep-links into the dashboard when a viewer URL is configured.

## Challenges / constraints

- **Header hygiene**: Respect stripping/redaction at proxies; avoid leaking PII in trace payloads stored for debugging.
- **Clock skew**: Ordering across hosts may rely on causal order + monotonic sequence numbers rather than wall clock alone.
- **Async boundaries**: Queues and webhooks break strict parent/child trees—model as **linked spans** or async edges.
- **Opt-in overhead**: Propagation and aggregation should be **cheap** and disable cleanly for prod-adjacent paths.

## MVP vs later

**MVP (high leverage, smaller blast radius)**

- Documented **correlation header contract** + helpers in core/bootstrap packages.
- Opt-in **trace JSON sidecar** or Redis/dashboard append-only event keyed by `traceId` (implementation TBD).
- **Dashboard-first trace UI** for DevX (minimal viable: trace list + ordered hops + links to mocks); optional standalone HTML viewer only where embedding is impractical.

**Later**

- Automatic **merge detection** (same handler tick, multiple outbound mocks within window).
- Diff across record vs replay **per trace**.
- OTLP export or alignment with OpenTelemetry traces already in the org.

## Relationship to existing Mockifyer ideas

- **Scenarios / lanes**: Traces should carry enough metadata to reconcile **per-client** or **per-env** divergence without collapsing unrelated traffic.
- **Record vs replay modes**: Trace IDs stable across modes make **drift** visible at chain granularity.
- **Dashboard proxy**: Could become the **aggregation hub** when traffic flows through known lanes—but traces must still work for **pure local filesystem** mocks.

## Open questions

1. **Canonical ID**: Prefer W3C `traceparent` only, Mockifyer-specific ID only, or **both** with mapping rules?
2. **Storage**: Central collector vs federated merge at dashboard pull-time vs hybrid?
3. **Privacy**: Default redaction rules for bodies in trace views vs “mock-safe” payloads only?
4. **GraphQL**: Treat as single hop vs resolver-level subgraph spans (probably hop-first for MVP).

## Success metrics (draft)

- Time to answer “why did this composite API return X?” drops from **multi-log digging** to **one dashboard trace view** (majority of sessions never require exporting raw trace JSON).
- Replay regressions cite **specific hop** in bug reports rather than “something’s wrong downstream.”
- Qualitative: engineers describe mock debugging as **easier than correlating logs across services** for typical integration issues.

---

*Status: planning / discovery — no implementation commitment encoded here.*
