# Explicit default scenario, strict activation, auto-create (implementation spec)

Summary of what to build, grounded in current behavior and recent product decisions.

## Goals

1. **Single clear default scenario** at Mockifyer init (name + documented precedence vs env, file, Redis global, per-lane).
2. **Optional strict mode**: do not treat the integration as “ready to mock” until a scenario is **explicitly** resolvable—where “explicit” includes **dashboard-bound lane** (`clientId` + `client_scenario:{clientId}`), not only a GUI scenario picker.
3. **Auto-create missing scenarios** when setting a default/switching to a **sanitized** name that does not exist yet (align filesystem with Redis’s “switch first, populate on first write” story where safe).
4. **Optional — effective scenario telemetry**: record **last resolved** scenario from the proxy per lane (and optionally per device) so the UI can show **configured vs last effective** and detect **client body `scenario` overrides**.

## Current baseline (what exists today)

| Area | Behavior |
|------|----------|
| Redis `POST /api/scenario-config/set` | Allows switching to a scenario **not** in the list; comment says created on first write ([`scenario-config.ts`](packages/mockifyer-dashboard/src/routes/scenario-config.ts)). |
| Filesystem `POST /set` | **404** if scenario not in `listScenarios` — must “create” first ([`scenario-config.ts`](packages/mockifyer-dashboard/src/routes/scenario-config.ts) L112–117). |
| Proxy resolution | Body `scenario` overrides per-lane Redis then global ([`proxy.ts`](packages/mockifyer-dashboard/src/routes/proxy.ts) + [`redis-mock-store.ts`](packages/mockifyer-dashboard/src/utils/redis-mock-store.ts) `scenarioKey`). |
| Core | `MOCKIFYER_SCENARIO` env first in `getCurrentScenario` ([`scenario.ts`](packages/mockifyer-core/src/utils/scenario.ts)); JSDoc order is wrong vs code — fix when touching. |

## 1. Default scenario at init

- **Add or formalize** one config surface, e.g. `MockifyerConfig.defaultScenario?: string` (and/or document that it merges with existing `scenarios?.default` and `MOCKIFYER_SCENARIO` with an explicit precedence table).
- **Document** for React Native / proxy: default applies when **no** per-request override, **no** lane-resolved scenario, or as seed for first run—depending on final precedence rules.
- **Deliverable**: README + types JSDoc + one truth table (env → config default → scenario-config file → Redis global → per-lane).

## 2. Strict activation (“no scenario → Mockifyer off”)

Define **exactly** what “resolved scenario” means before interceptors/proxy usage is allowed:

- **Lane-first (dashboard-only scenario)**: “Explicit” = non-empty `clientId` **and** resolvable scenario from Redis (`client_scenario:{clientId}` or allowed fallback—**you** decide whether global `active_scenario` still counts in strict mode).
- **App-picked scenario**: Optional GUI sets `proxyScenario` / local default → counts as explicit if non-empty after sanitize.
- **Failure mode**: pass-through HTTP, or throw on first intercepted call, or `setupMockifyer` returns `not_ready`—pick one and make it consistent across `mockifyer-fetch` / axios / RN wrapper.

**Product note:** Do not require an in-app scenario picker if **lane + dashboard mapping** is the intended control plane; strict mode should treat that as sufficient “explicit.”

## 3. Auto-create scenario on set default / switch

**Filesystem / sqlite dashboard paths**

- On `POST /set` (and any new “set default scenario” API), if sanitized name is **not** in `listScenarios`, **create** it instead of 404:
  - `ensureScenarioFolder(mockDataPath, name)` (or equivalent from [`scenario.ts`](packages/mockifyer-core/src/utils/scenario.ts)) + optional empty guard files only if needed.
  - Update `scenario-config.json` (or per-client file) as today.
- **Dashboard list**: include the new name so UI stays consistent.

**Redis**

- Already allows switch to unknown name; optionally **register** empty scenario in any **index/list** helpers if `listScenarios` should show it before first mock write (only if `listScenarios` today misses pure Redis-only names—verify [`RedisMockStore.listScenarios`](packages/mockifyer-dashboard/src/utils/redis-mock-store.ts)).

**Typos / safety**

- Keep **sanitization** as today; consider UX: toast “Created new empty scenario `x`” vs confirm dialog for **create** when not in list.

## 4. Global scenario role

- In **strict + lane-first** setups, **demote** global `active_scenario` to:
  - optional fallback only, or
  - disabled when strict mode says “lane must be mapped.”
- Document migration: teams that relied only on global need a one-time **lane → scenario** bind or an explicit init default.

## 5. Client / proxy behavior (avoid two mental models)

- **Recommendation**: default app integration **omits** proxy body `scenario` so **dashboard per-lane** stays authoritative; document that **setting `proxyScenario` overrides** lane mapping (escape hatch for E2E).
- If you add **runtime default scenario** in the client, wire it through the same sanitize + optional create path **or** only set server state via dashboard API—avoid diverging rules.

## 6. Effective scenario observability (proxy)

**Problem:** The dashboard already shows **configured** scenario per lane (`client_scenario:{clientId}`). That is the *intended* policy. It does **not** reveal what the proxy *actually used* when the client sends a **body `scenario` override**, when resolution **falls through** to global / filesystem, or right after someone **changes** the mapping (sanity check that new traffic picked it up).

### Backend (proxy + Redis)

- On each `POST /api/proxy` request, after `getResolvedScenario` / `resolvedScenario` is known in [`proxy.ts`](packages/mockifyer-dashboard/src/routes/proxy.ts), **record aggregates** (best-effort):
  - `resolvedScenario` (effective name),
  - `clientId`, optional `deviceId`,
  - flags: **client sent non-empty body `scenario`** (override), and optionally **resolution source** (override vs lane key vs global vs filesystem fallback).
- Persist in Redis (e.g. hash or small JSON per lane; optional per-lane+device key for drill-down) with **timestamp** of last observation. TTL or trim policy to match existing lane/device discovery (~14d) unless you add a separate audit stream.

### GUI (Client Lanes and related)

- **Per lane:** keep **configured scenario**; add **last effective scenario** + **last activity** time. Optional badge **“Client override”** when the last recorded request used a body `scenario`.
- **Per device** (under a lane): extend device rows with **last effective scenario** + last seen (today you only have last seen via [`recordLaneDeviceSeen`](packages/mockifyer-dashboard/src/utils/redis-mock-store.ts)).
- **Redundancy is expected:** for most traffic with no override and stable mapping, **configured === last effective**. The extra column pays off when they **diverge** (override, fallback, or post-dashboard-edit verification).
- **Copy / UX:** label last effective as **“last seen resolved”**, not “currently running,” unless you add heartbeats. Show **“—”** when no proxy traffic recorded yet.
- **Optional phase 2:** click lane/device → short **history** (last N resolutions) for debugging.

### API

- Extend `GET /api/client-lanes` (or add `GET /api/client-lanes/effective`) to return configured + last-effective fields for each lane and optionally nested devices.

## 7. Tests & verification

- Dashboard: `POST /set` filesystem path — new name creates folder + succeeds; list includes scenario.
- Strict mode: unit/integration for “no resolution → inactive / passthrough.”
- Regression: Redis `POST /set` still works; proxy precedence unchanged unless you intentionally gate strict mode in [`proxy.ts`](packages/mockifyer-dashboard/src/routes/proxy.ts).
- Effective scenario: proxy writes aggregates; client-lanes API returns them; UI shows drift when override used.

## 8. Out of scope (unless you expand later)

- Per-device scenario without `clientId` (still recommend distinct lanes).
- Auth on dashboard APIs.
- Removing proxy `scenario` override entirely (breaking change).

---

**Suggested implementation order:** (3) filesystem auto-create on set → (1) defaultScenario + docs/precedence → (2) strict activation flag → (4) global fallback policy → (6) effective-scenario aggregates + client-lanes API + UI columns.
