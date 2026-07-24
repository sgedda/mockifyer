# Mockifyer Prompt-as-You-Go Demo

Live presentation you can **run by copying prompts** into Cursor (or any agent with `mockifyer-mcp` + repo tools). Each slide is one beat:

1. **Copy the prompt**
2. **Wait for the agent to finish**
3. **Show** both surfaces listed on the slide — **App** and **Dashboard**
4. **Advance** to the next prompt

**Stage layout (keep this up the whole talk):**

```text
┌─────────────────────────┐  ┌─────────────────────────┐
│  Trips app (product)    │  │  Mockifyer Dashboard    │
│  :5174 / :4200 / …      │  │  :3002                  │
└─────────────────────────┘  └─────────────────────────┘
```

The showcase is **not** app-only. The dashboard is where you browse mocks, switch scenarios, edit overrides, bind client lanes, open Network traces, and manage the fixture pool — while the app proves the product impact.

Trips Showcase nouns are the default example. Beats still prove Mockifyer’s purpose when UI, destinations, ports, or filenames look different.

**How to read:** each `---` is a slide. `PROMPT` = copy-paste. `SHOW` = App + Dashboard. `INVARIANT` = what must still be true.

## Document set

| Doc | Role |
|---|---|
| [`trips-showcase-prompt-demo.md`](./trips-showcase-prompt-demo.md) | **This file** — prompt → show (app + dashboard) → next |
| [`trips-showcase-adoption-presentation.md`](./trips-showcase-adoption-presentation.md) | Capability adoption slides |
| [`trips-showcase-demo.md`](./trips-showcase-demo.md) | Prospect Acts 1–4 (no agent required) |
| [`trips-showcase-presentation.md`](./trips-showcase-presentation.md) | Technical `$pool` / curl deck |
| [`trips-showcase.md`](./trips-showcase.md) | Build plan |

**Ships as:** `example-projects/trips-showcase/docs/PROMPT_DEMO.md`

---

# 00 · Can you replicate this live? (presenter notes)

**Short answer: yes — if you demo *behaviors*, not pixels — and you keep the dashboard on stage.**

| Purpose (must show) | Surface noise (may differ) |
|---|---|
| HTTP is intercepted; record → replay | Exact Vite theme, port numbers |
| **Dashboard** is the ops UI for fixtures | Tab names / exact panel chrome |
| Product **worlds** swap via scenarios | Scenario names (`check-in-open` vs `ready-to-board`) |
| Time / fields bend without re-record | Exact `offsetHours`, field paths |
| Parallel clients don’t stomp each other | Client id strings |
| Multi-hop “who failed?” is visible in **Network** | Number of services (2 vs 5) |
| Shared fixture + compose (optional headline) | Pool id / select values |

### Replicability contract

```text
OK if:  cities, CSS, login labels, filenames, ports differ
FAIL if: you cannot switch a product state without redeploying stubs
FAIL if: two clients cannot see different scenarios on one stack
FAIL if: you cannot point at a mock in the Dashboard (or JSON) as source of truth
FAIL if: the talk never opens the Dashboard (app-alone is incomplete for this showcase)
```

### Demo modes

| Mode | When | Prep |
|---|---|---|
| **A — Seeded (safest live)** | Conference / customer call | Pre-built stack + `restore-demo.sh`; **Dashboard already on :3002**; prompts for compose/lanes/trace |
| **B — Prompt-from-scratch** | Workshop / internal | Longer; accept visual variance; still start Dashboard early |
| **C — Hybrid (recommended)** | Most demos | Pre-scaffold app + mocks + **Redis dashboard**; prompts for scenarios / `$pool` / lanes / Network |

**Recommendation:** Mode C with **App | Dashboard** side-by-side from slide 03 onward.

### Timing

| Path | Slides | ~Duration |
|---|---|---|
| Fast | 03 → 04 → 06 → 07 → 08 → 10 | 10–15 min (seeded app + dashboard) |
| Full | 01–12 | 30–45 min |
| Fail-safe | Skip 01–02; restore + open Dashboard at 03 | Always available |

---

# 01 · Create a useful trips-like application

**Goal:** Runnable product shell — login, list, detail, date-based CTA — enough surface for Mockifyer + Dashboard to matter.

### PROMPT (copy)

```text
Create a small trips demo app I can run locally (Vite + React + TypeScript preferred).

Must include:
1. Login with two demo users (e.g. alice / bob, password demo).
2. My Trips list after login (at least 3–4 trips with id, destination, status, departureAt).
3. Trip detail view.
4. A check-in CTA that appears only when status is CONFIRMED and departureAt is within 10 hours of "now".
5. Important: all "now" comparisons must use a getCurrentDate() helper I can later swap for Mockifyer's getCurrentDate — do not sprinkle new Date() in business rules.
6. A simple BFF or API layer the UI calls (not only hardcoded client state). Prefer one /api/home or /api/trips that the UI uses.
7. README with npm install / npm run dev and default ports.

Keep the UI minimal and readable. Seed realistic trip data including one trip that can become "check-in open" when time is bent.
```

### SHOW

| App | Dashboard |
|---|---|
| `npm run dev` → login Alice → My Trips | *(not yet — next two slides)* |
| Open one trip detail; point at check-in rule in code | — |

### INVARIANT

- UI talks to an HTTP API/BFF, not only in-memory React state.
- Check-in rule uses a swappable clock helper.

### If the app looks different

Different fonts/cities/CTA labels are fine if list + time-gated action + HTTP boundary exist.

---

# 02 · Wire Mockifyer + start the Dashboard

**Goal:** Intercept HTTP **and** stand up the Mockifyer Dashboard as the second stage window (proxy + UI).

### PROMPT (copy)

```text
Wire Mockifyer into this trips app/API and make the Mockifyer Dashboard part of the demo stack.

Requirements:
1. Install @sgedda/mockifyer-core, @sgedda/mockifyer-fetch (or axios), and @sgedda/mockifyer-dashboard (devDependency or npx is fine).
2. Bootstrap each process that issues HTTP with initMockifyerForDashboardProxy (preferred for this showcase) pointing at http://127.0.0.1:3002, shared MOCKIFYER_PATH=./mock-data, and MOCKIFYER_CLIENT_ID.
   Also document initMockifyerForLocalFilesystem as a fallback if Redis is down.
3. Add scripts/README to start:
   - Redis (docker compose or redis:up if present)
   - Dashboard: npx mockifyer-dashboard --provider redis --path ./mock-data --port 3002
     (or the project's npm run dashboard:redis equivalent)
   - App / BFF / services
4. Env: MOCKIFYER_PATH, MOCKIFYER_SCENARIO=default, MOCKIFYER_RECORD, MOCKIFYER_PROXY_URL, MOCKIFYER_CLIENT_ID.
5. Replace business-rule clocks with getCurrentDate from the same Mockifyer package as setup.
6. Do not redesign product screens.

Print the exact commands to open App + Dashboard side by side.
```

### SHOW

| App | Dashboard |
|---|---|
| Bootstrap file shows `initMockifyerForDashboardProxy` (or setup + proxy) | Open **http://localhost:3002** — home/mocks shell loads |
| `getCurrentDate()` in check-in rule | Point at scenario indicator / mock-data path in UI |
| Env exports visible in README | Leave Dashboard tab pinned for the rest of the talk |

### INVARIANT

- HTTP process is patched.
- Dashboard is running against the **same** `mock-data` (and Redis when using lanes/proxy).

### SAY

*“Left side is the product. Right side is how we operate the API world.”*

---

# 03 · Tour the Dashboard (first-class beat)

**Goal:** Audience knows where every later beat will be clicked — before more prompting.

### PROMPT (copy)

```text
Give me a 60-second presenter tour of the Mockifyer Dashboard for this project.

List the exact UI areas I should click, in order, and what each is for in a trips demo:
1. Mocks list / search (find trips or home)
2. Scenario switcher (or scenario config)
3. Opening one mock: response body, Always use live API, field/date overrides if shown
4. Client lanes (if redis/sqlite provider)
5. Network / network log + how to enable Bodies
6. Fixture pool / responses (if present in this build)
7. Settings that matter for record-on-miss / proxy

Assume dashboard is already on :3002 with --provider redis. Adapt labels to whatever this version of the UI actually shows.
```

### SHOW (presenter drives; follow the agent’s click list)

| App | Dashboard |
|---|---|
| Keep My Trips visible but don’t click yet | Walk Mocks → one trips mock → response JSON |
| — | Show scenario control |
| — | Show Client lanes page (even if empty) |
| — | Show Network tab; note how to enable logging/Bodies |
| — | Show Fixture pool (or say “we’ll use this in the compose beat”) |

### INVARIANT

Audience can name **Mocks, Scenarios, Lanes, Network** (and Pool if present) before you change any data.

### SAY

*“We won’t hide in JSON folders — the Dashboard is the control plane.”*

---

# 04 · Record a golden happy path

**Goal:** Capture traffic once; prove replay; **see the recording appear in the Dashboard**.

### PROMPT (copy)

```text
Help me record a golden default scenario for this trips app with the Dashboard visible.

1. Set MOCKIFYER_RECORD=true (and/or dashboard record-on-miss as appropriate for proxy mode).
2. Exact commands to start Redis + Dashboard + app stack.
3. Manual script: login as Alice → My Trips → home/detail if present.
4. After recording, RECORD=false; list new mocks under mock-data/default AND how to find them in the Dashboard Mocks UI.
5. One-line summary per endpoint (method + path + purpose).
6. Tell me what to click in the Dashboard to open the trips list mock body.
```

### SHOW

| App | Dashboard |
|---|---|
| Record on → click Alice happy path once | Mocks list **gains** trips/home/bookings entries (refresh if needed) |
| Record off → reload My Trips — still works | Open trips mock → show real response JSON |
| Optional: kill upstream seed; reload again | Toggle/explain “Always use live API” if present on a fresh recording |

### INVARIANT

- Replay works without live upstream.
- The same fixture is visible as a **Dashboard mock row**, not only a git file.

---

# 05 · Use the product (pause — dual surface)

**Goal:** Let them believe it’s a real app; keep Dashboard as the “source of truth” glance.

### SHOW (no new prompt)

| App | Dashboard |
|---|---|
| Login Alice → My Trips → detail | Same scenario selected (`default`) |
| Optional Bob / empty user | Spot the matching auth/trips mocks in the list |
| Refresh with backends down | “These rows are what the app is eating” |

### SAY

*“From here, every change is in the Dashboard (or via MCP into the same store) — the React tree stays put.”*

---

# 06 · Create product-state scenarios

**Goal:** Whole-world switches via Dashboard/MCP; prove them in the app.

### PROMPT (copy)

```text
Using Mockifyer MCP and/or Dashboard APIs, create product scenarios derived from default:

1. check-in-open — one CONFIRMED trip can show the check-in CTA
2. empty-trips — My Trips empty state
3. booking-error — bookings hop fails (e.g. 503) while trips still load (if home merge exists)

For each:
- create with deriveFrom: "default" when possible
- prefer responseFieldOverrides / responseDateOverrides over huge JSON copies
- tell me the Dashboard clicks to switch scenario AND the MCP/tool equivalent
- adapt trip ids/filenames to what exists in mock-data

Do not redesign the UI.
```

### SHOW

| App | Dashboard |
|---|---|
| Refresh after each switch | Scenario → `empty-trips` → save/active |
| Empty state visible | Mocks filtered/listed under that scenario |
| Switch → `check-in-open` → CTA on | Same control; point at scenario name in chrome |
| Back to `default` → full list / CTA off | Scenario back to default |

### INVARIANT

Same binary; worlds change from the **Dashboard scenario control** (or lane — later), not a frontend feature flag.

---

# 07 · Bend time / fields (overrides) in the Dashboard

**Goal:** Calendar + field control without re-recording — edited where operators live.

### PROMPT (copy)

```text
In scenario check-in-open, make check-in open using Mockifyer overlays — do not re-record.

1. Inspect the trips list mock (mockifyer_get_mock_ai_context or Dashboard mock detail).
2. Set responseDateOverride so the chosen trip departureAt is ~10h from Mockifyer "now".
3. Ensure status CONFIRMED via field override if needed.
4. Tell me exactly where in the Dashboard I open/edit those overrides (or date config), and how to flip them off for contrast.
5. Confirm the app uses getCurrentDate().
```

### SHOW

| App | Dashboard |
|---|---|
| CTA **on** after override | Mock detail → overrides / date fields visible |
| CTA **off** after flip | Same panel — change offset or clear override; save |
| — | Emphasize: no new “recorded at” capture required |

### INVARIANT

UI clock + payload timestamps stay aligned; Dashboard shows the override as the mechanism.

### SAY

*“We didn’t wait for a real departure window — and we didn’t hand-edit a mystery JSON path in the dark.”*

---

# 08 · Parallel lanes (Dashboard Client lanes + two app tabs)

**Goal:** Isolation for E2E / multi-tester — bind in Dashboard, prove in two browsers.

### PROMPT (copy)

```text
Set up Mockifyer client lanes for this trips demo (Dashboard --provider redis).

1. Bind in Dashboard / via MCP:
   - trips-e2e-stable → default (or qa-stable)
   - trips-e2e-checkin → check-in-open
   - trips-e2e-empty → empty-trips
2. Tell me Dashboard clicks: Client lanes → set scenario per clientId.
3. How to open two app tabs with different MOCKIFYER_CLIENT_ID / X-Mockifyer-Client-Id.
4. Optional Playwright projects 1:1 with those ids.

Use mockifyer_set_client_lane_scenario / list_client_lanes when MCP is available.
```

### SHOW

| App | Dashboard |
|---|---|
| Tab A `trips-e2e-stable` → default world | **Client lanes** UI lists both (all three) bindings |
| Tab B `trips-e2e-checkin` → CTA on | Point at lane → scenario mapping; no process restart |
| Optional third tab empty | Same page — `trips-e2e-empty` |

### INVARIANT

Two concurrent clients → two scenarios on one stack; bindings visible in **Dashboard Client lanes**.

### Fail-soft

Redis down → show lanes UI empty/error briefly, then fall back to global scenario switch (slide 06) without derailing.

---

# 09 · Compose from a shared pool (`$pool`) — Dashboard + app

**Goal:** One promoted list; scenarios hold refs; verify in Fixture pool UI and app.

### PROMPT (copy)

```text
Compose check-in-open from a shared fixture pool (no duplicated trip blobs).

1. Promote default Alice trips-list into the pool (clear id, e.g. trips-list-alice) — prefer MCP promote or Dashboard Fixture pool actions.
2. Preview $pool document ref: keep envelope, select only the check-in candidate trip by id.
3. Set that $pool ref on the check-in-open trips mock.
4. Re-apply ~10h departure overlay on the resolved path.
5. Tell me Dashboard places to show: pool response fixture, scenario mock with $pool node, preview if available.
6. Bind lane trips-e2e-checkin → check-in-open; how to verify in the app.

Adapt filenames/ids to this repo's mock-data.
```

### SHOW

| App | Dashboard |
|---|---|
| Check-in lane → CTA still works | **Fixture pool** → `trips-list-alice` (or chosen id) once |
| — | Open `check-in-open` trips mock → **`$pool` node** in body |
| — | Preview/resolve if UI exposes it; else show agent preview output beside Dashboard |

### INVARIANT

One canonical pool fixture; scenario is composition; app still shows the product state.

### SAY

*“Fixtures are a library. Scenarios are composition. Dashboard is where you see both.”*

---

# 10 · Trace in Dashboard Network (+ chaos)

**Goal:** Multi-hop “who failed?” using the Dashboard Network UI (MCP optional backup).

### PROMPT (copy)

```text
Demonstrate Mockifyer network tracing with the Dashboard Network tab as the primary SHOW surface.

1. Enable network logging and Bodies in the Dashboard; confirm with mockifyer_get_network_log_config if MCP is available.
2. Which UI action triggers the multi-hop chain (home/aggregate — adapt to this app)?
3. After I click it, show me how to find the request in Dashboard Network and open the ordered trace (hops, status, timing).
4. Also give MCP/curl equivalents (list_network_events / get_network_trace) as backup.
5. Switch to booking-error (scenario or lane), trigger home again, and show the failing bookings hop in Network while trips still render in the app.
```

### SHOW

| App | Dashboard |
|---|---|
| Trigger Home / chain once | **Network** → latest events → open trace / request id |
| Trips still visible under chaos | Hops list: statuses + durations |
| Flip `booking-error` → degraded bookings UX | Same Network view → bookings hop red/503 |

### INVARIANT

Network UI shows the call chain (or honest single-hop log); chaos is a scenario, not a stub rewrite.

---

# 11 · Optional — improv state (Dashboard + lane)

**Goal:** Invent a state live without a hotfix branch.

### PROMPT (copy)

```text
Without redeploying the app, create scenario demo-improv derived from default where:
- primary list shows exactly two items ($pool select or overrides/copy_array_item)
- one item status CANCELLED
Show me where this appears in the Dashboard (scenario list + mock detail).
Bind lane trips-e2e-improv → demo-improv so other tabs stay untouched.
Explain how to delete/archive via Dashboard or MCP after the demo.
```

### SHOW

| App | Dashboard |
|---|---|
| Improv lane → two rows, one cancelled | New scenario visible; mock detail shows edits/`$pool` |
| Stable tab unchanged | Client lanes: improv binding only on that clientId |

---

# 12 · Closing (leave App + Dashboard on screen)

### Purpose proven today

```text
Record → see mocks in Dashboard
  → Replay in App
  → Switch scenarios in Dashboard → App worlds change
  → Edit overrides / time in Dashboard → CTA flips
  → Bind Client lanes in Dashboard → two App tabs diverge
  → Compose $pool in Dashboard/pool → App still correct
  → Network tab explains multi-hop / chaos
```

### Copy-paste CTA

```text
Tonight:
1) init Mockifyer on API-calling processes
2) run mockifyer-dashboard (redis if you need lanes/proxy)
3) record one golden scenario — open it in the Dashboard
4) derive one edge scenario with overrides in the Dashboard
5) if two people demo at once, bind Client lanes
```

### Presenter fail-safes

| Problem | Move |
|---|---|
| Agent UI looks weird | Keep Dashboard as the steady control plane |
| Record failed | restore-demo + still tour Mocks in Dashboard |
| Redis down | Filesystem dashboard still shows Mocks/scenarios; skip lanes/Network persistence |
| Pool confuses room | Stop after Dashboard scenario + override beats |
| Timeboxed | Seeded: 03 tour → 05 product → 06 scenarios → 07 overrides → 08 lanes → 10 Network |

### One-liner

> **If the App shows the product impact and the Dashboard shows the fixture control plane — the showcase worked, even when the pixels differ.**

---

# Appendix A · Prompt pack

**A1** Create app — slide 01  
**A2** Wire Mockifyer + Dashboard — slide 02  
**A3** Dashboard tour — slide 03  
**A4** Record golden — slide 04  
**A5** Scenarios — slide 06  
**A6** Overrides / time — slide 07  
**A7** Lanes — slide 08  
**A8** `$pool` compose — slide 09  
**A9** Network trace + chaos — slide 10  
**A10** Improv — slide 11  

---

# Appendix B · Domain swap table

| Trips demo noun | Your domain |
|---|---|
| Trip / destination | Order / SKU / booking / subscription |
| Check-in CTA | Pay / renew / unlock / submit |
| `departureAt` ≤ 10h | `expiresAt`, SLA window, trial end |
| `check-in-open` | `checkout-ready`, `trial-ending` |
| `empty-trips` | `empty-cart`, `no-subscriptions` |
| `booking-error` | `payments-down`, `inventory-503` |
| `trips-list-alice` | `orders-list-alice` |
| `trips-e2e-checkin` | `orders-e2e-paywall` |
| Dashboard Mocks row | Same — find your list endpoint |
| Dashboard Network | Same — your aggregate/home call |

```text
If this repo is not trips-themed, keep the same Mockifyer + Dashboard behaviors but rename scenarios and fields to match mock-data.
```

---

# Appendix C · Replicability + Dashboard

1. **Always stage two windows** — App alone undersells the product; Dashboard alone is a file browser without payoff.
2. **Agent UI drifts; Dashboard labels drift less** — when the app looks “wrong,” narrate from Dashboard mocks/scenarios/lanes/Network.
3. **MCP is optional glue** — every compose beat should be doable as Dashboard clicks if MCP fails (slide 00 fail-soft).
4. **Filesystem vs Redis** — Mocks + scenarios work on filesystem provider; lanes, proxy, and durable Network need redis/sqlite — say that honestly mid-demo if needed.
5. **One prompt → one SHOW on both panes → breathe.**
6. **Success metric** — audience can open Dashboard next week on *their* app and switch a scenario while their UI updates.
