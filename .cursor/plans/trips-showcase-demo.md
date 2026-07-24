# Trips Showcase — Prospect Demo Script

Presentation / staging plan for live demos and prospect walkthroughs of the Ultimate Trips Showcase. **Does not change the example architecture** — it defines *what to show and in what order*.

**Positioning copy:** [`mockifyer-why-awesome.md`](./mockifyer-why-awesome.md)  
**Ships as:** `example-projects/trips-showcase/docs/DEMO.md` (plus pitch `README.md` sections)

## Document set (read together)

| Doc | Role |
|---|---|
| [`trips-showcase.md`](./trips-showcase.md) | **Build plan** — app, services, `$pool`, lanes, MCP, tests, seed/restore |
| [`trips-showcase-demo.md`](./trips-showcase-demo.md) | **Live demo staging** — Acts 1–4, wow SLAs, audience cuts |
| [`trips-showcase-presentation.md`](./trips-showcase-presentation.md) | **Technical slides** — graphs, sample payloads, curl/MCP, map to your stack |

**This file** is the live-demo row above. The example project can look the same either way. Demo-polish affordances (Demo panel time/scenario/lane controls, `booking-error`, `restore-demo.sh`) make Acts 1–4 easy to stage — already implied by the build plan.

---

## Success bars

| Bar | Target |
|---|---|
| **Clone → wow** | `restore-demo.sh` + open app → Act 1 payoff in **&lt; 2 minutes** |
| **Act 1 alone** | Stranger completes without reading docs |
| **Acts 2–3** | Follow [`PROMPTS.md`](../../example-projects/trips-showcase/docs/PROMPTS.md) / this script only |
| **DRY proof** | Say out loud: **1 promoted list → 4+ scenarios → 0 duplicated trip blobs** |

---

## Pre-demo setup

- Stack up (compose + dashboard Redis proxy + Vite app).
- `restore-demo.sh` applied (seed + pool + scenario `$pool` nodes + lane defaults).
- Dashboard open; Cursor/MCP connected when doing Act 3.
- Two browser contexts ready (or one window + second tab with different `MOCKIFYER_CLIENT_ID`).
- Default lane / clock: Alice full list, NYC **not** yet in check-in window (`getCurrentDate()` frozen so CTA is off until Act 1).

---

## Demo paths

- **Path A (60–90s):** Act 1 only — product/sales, first impression.
- **Path B (full):** Acts 1 → 2 → 3; Act 4 if time/audience.
- Architecture / five services appear as **support for Acts 3–4**, not the opening slide.

---

## Act 1 — Time & scenarios (~90s)

**Job:** Sell product states + calendar — not “we have mocks.”

### Show

1. Login as Alice → My Trips (Rome, NYC, Tokyo, Lisbon). NYC is a normal upcoming trip — **no check-in CTA**.
2. Demo panel (`VITE_DEMO_CONTROLS=true`) or dashboard: switch to `check-in-open` **or** nudge Mockifyer “now” so NYC `departureAt` crosses the ≤10h rule (with `CONFIRMED`).
3. UI updates: **Check-in** appears on NYC only. Business rules use `getCurrentDate()`.

**Optional (+15s):** flip `empty-trips` → empty state → back. Proves whole-world scenarios, not one flag.

### Say

- “We didn’t redeploy a mock server or rewrite handlers.”
- “Same recorded trips payload; scenario overlays + time change the *product state*.”
- Vs MSW (one line): “We preserved a real list once; we compose states from it.”

### Leave them with

“Demo and CI can freeze time and swap worlds without a backend.”

### Showcase plan hooks

- Scenarios: `default` / `qa-stable`, `check-in-open`, `empty-trips`
- Demo panel + date overrides after `$pool` resolve
- Check-in rule: `departureAt - now <= 10h` && `CONFIRMED`

---

## Act 2 — Parallel client lanes (~60s)

**Job:** Sell isolation for E2E / multi-tester / agent runs.

### Show

1. Tab A: `MOCKIFYER_CLIENT_ID=trips-e2e-stable` → stable / default list (no check-in, or full list as designed).
2. Tab B: `trips-e2e-checkin` bound to `check-in-open` → check-in visible.
3. Demo panel or dashboard client-lane list: same Redis proxy, **two lanes, two scenarios**, no env restart fight.

**Optional:** mention Playwright projects map 1:1 to these lanes; don’t run the suite unless asked.

### Say

- “Two browsers, two clients, one stack — no stomping each other’s fixtures.”
- “Automation gets a private API world per run.”

### Leave them with

“E2E lanes are first-class, not a shared global mock mode.”

### Showcase plan hooks

- Redis lanes + `mockifyer_set_client_lane_scenario` / `list_client_lanes`
- Playwright matrix: `trips-e2e-checkin` / `empty` / `stable`

---

## Act 3 — Agent / MCP compose with `$pool` (~3–4 min)

**Job:** Headline product story — promote once, compose scenarios with refs + overlays.

### Show (narrate; follow PROMPTS.md)

1. Inspect default trips mock (dashboard or MCP `get_mock_ai_context`) — full Alice envelope.
2. **Promote** → `trips-list-alice` in the pool.
3. **Create scenario** `check-in-open` with `deriveFrom: default`.
4. **Preview** then **set** `$pool` document ref:

```json
{
  "id": "trips-list-alice",
  "mode": "document",
  "path": "trips",
  "select": { "field": "id", "values": ["trip-nyc-checkin"] }
}
```

5. Date/field override on resolved path (`departureAt` ≈ now+10h).
6. **Bind lane** `trips-e2e-checkin` → `check-in-open`.
7. Verify in app (or Act 2 tab B) — same CTA as Act 1; audience saw *how* it was composed.

**Nice-to-have:** tiny git or dashboard diff — scenario file is a `$pool` node + overlays, not a copied trip blob.

**Do not do here:** full multi-hop debug (Act 4). Stay on promote → scenario → pool → lane → verify.

### Say

- “Four scenarios, one promoted list — scenarios hold refs + overlays, not duplicated trip JSON.”
- “An agent can do this without hand-editing mock files.”

### Leave them with

“Fixtures are a library; scenarios are composition.”

### Showcase plan hooks

- Fixture pool + `$pool` tutorial arc (core demo)
- MCP tools from PR #281 / #284 (already shipped)

---

## Act 4 — Trace / chaos (optional, ~2–3 min)

**Job:** Ops/debug + “we can demo bad days” — platform / senior buyers.

### Trace beat

1. Load Home (BFF merge: auth + trips + bookings + catalog).
2. Take `X-Mockifyer-Request-Id` → Network trace (dashboard or MCP).
3. Show hops + field provenance (“where did destination title come from?”) / slowest hop / duplicates.

### Chaos beat

1. Flip to `booking-error` (Demo panel or lane).
2. Home still shows trips; bookings path fails gracefully — real product UX under failure.

### Say

- “Multi-service demos usually die on ‘which hop broke?’ — here the chain is visible.”
- “Outage scenarios are first-class, not a weekend of stub rewriting.”

### Leave them with

“Same system for showcase, CI, and incident rehearsal.”

### Showcase plan hooks

- Tracing + insights section; `booking-error` scenario

**Skip if short on time** — Acts 1–3 close most sales.

---

## Closing (~30s)

- Point at `example-projects/trips-showcase` + `restore-demo.sh`: clone → wow in &lt;2 min.
- One-liner (from positioning): *Record real APIs, compose scenarios from a shared pool, isolate clients, control time.*
- CTA: Path A alone first; Path B (MCP) when they care about agents/CI.
- RN callout (honest): web showcase for clarity; same intercept + scenarios + lanes pattern as React Native — see REACT_NATIVE.md / why-awesome.

---

## Audience cheat sheet

| Audience | Emphasize | Can skip |
|---|---|---|
| Product / sales eng | Acts 1–2 | Act 3 deep MCP |
| QA / E2E | Acts 2 + Playwright mention | Long pool promote |
| Platform / Cursor users | Acts 1 + 3 | Chaos |
| Architects | Acts 3–4 + DRY number | — |

---

## Prospect-facing artifacts (ship with the example)

| Artifact | Role |
|---|---|
| `example-projects/trips-showcase/README.md` | Pitch: one-liner, Path A/B, DRY number, vs MSW/WireMock one-liner, screenshots/GIFs |
| `docs/DEMO.md` | This script (acts + setup + audience cuts) |
| `docs/PRESENTATION.md` | Technical slide deck ([`trips-showcase-presentation.md`](./trips-showcase-presentation.md)) |
| `docs/TUTORIAL.md` | Builder walkthrough (align section order with Acts where useful) |
| `docs/PROMPTS.md` | MCP prompts for Act 3 (+ optional Act 4) |

Internal PR numbers and tool registries stay in [`trips-showcase.md`](./trips-showcase.md); user-facing copy stays product-language.

---

## Implementation todos (presentation)

- [ ] Add `docs/DEMO.md` from this plan when scaffolding the example
- [ ] README pitch section: Path A/B, DRY number, RN callout, restore-to-wow
- [ ] Ensure Demo panel supports Act 1 (scenario + time) and Act 4 (`booking-error`) without leaving the app
- [ ] Pre-demo clock/lane defaults documented in DEMO.md + restore script
- [ ] Optional: 60–90s GIF / short video matching Act 1 for README
- [ ] Point DEMO closing / README at `docs/PRESENTATION.md` for engineers who want curls + graphs
