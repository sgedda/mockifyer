# Mockifyer Prompt-as-You-Go Demo

Live presentation mixing **copy-paste prompts** (for beats that change state) with **presenter-driven** beats (Dashboard tour, product walkthrough). When a slide has `PROMPT (copy)`:

1. **Copy the prompt** into Cursor (or any agent with `mockifyer-mcp` + repo tools)
2. **Wait for the agent to finish**
3. **Show** both surfaces — **App** and **Dashboard**
4. **Advance**

When a slide says **presenter script — no prompt**, you click and narrate yourself. Do not invent an agent prompt for those.

**Stage layout (keep this up the whole talk):**

```text
┌─────────────────────────┐  ┌─────────────────────────┐
│  Trips app (product)    │  │  Mockifyer Dashboard    │
│  :5174 / :4200 / …      │  │  :3002                  │
└─────────────────────────┘  └─────────────────────────┘
```

The showcase is **not** app-only. The dashboard is where you browse mocks, switch scenarios, edit overrides, bind client lanes, open Network traces, and manage the fixture pool — while the app proves the product impact.

Trips Showcase nouns are the default example. Beats still prove Mockifyer’s purpose when UI, destinations, ports, or filenames look different.

**How to read:** each `---` is a slide. `PROMPT` = copy-paste agent prompt (when present). `PRESENTER SCRIPT` = you drive, no agent. `SHOW` = App + Dashboard. `INVARIANT` = what must still be true.

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

**Prompt rule:** only use `PROMPT (copy)` when the agent **changes state** or **produces an artifact** (scaffold, wire, record summary, MCP mutate, trace fetch). Never prompt “tell me where to click” — that’s the presenter script / SHOW column.

### Timing

| Path | Slides | ~Duration |
|---|---|---|
| Fast (seeded) | 03 → 05 → 06 → 07 → 08 → 10 | 10–15 min (skip 01–02; skip or skim 04) |
| Full | 01–12 | 30–45 min |
| Fail-safe | Skip 01–02; restore + open Dashboard at 03 | Always available |

---

# 01 · Create a useful trips-like application

**Goal:** Runnable product shell — login, list, detail, date-based CTA — enough surface for Mockifyer + Dashboard to matter.

**When to use this prompt:** Mode **B** (from scratch) only. Mode **A/C** (seeded/hybrid): **skip** — app already exists.

### PROMPT (copy) — Mode B

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

**When to use this prompt:** Mode **B** only. Mode **A/C**: **skip** — already wired; just start Redis + Dashboard + app from README.

### PROMPT (copy) — Mode B

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

Print the exact start commands for App + Dashboard (no UI click tour).
```

### SHOW

| App | Dashboard |
|---|---|
| Bootstrap file shows `initMockifyerForDashboardProxy` (or setup + proxy) | Open **http://localhost:3002** — home/mocks shell loads |
| `getCurrentDate()` in check-in rule | Leave Dashboard tab pinned for the rest of the talk |
| Env exports visible in README | — |

### INVARIANT

- HTTP process is patched.
- Dashboard is running against the **same** `mock-data` (and Redis when using lanes/proxy).

### SAY

*“Left side is the product. Right side is how we operate the API world.”*

---

# 03 · Tour the Dashboard (presenter script — no prompt)

**Goal:** Orient the audience on the control plane **before** any agent prompts that change state.

**Why no prompt here:** Asking Copilot to “list exact UI areas” gains almost nothing live — you already know the product, and the agent cannot see the screen. You drive this beat yourself (~60s).

### PRESENTER SCRIPT (click order)

Keep the trips **App** visible on the other monitor/half-screen; don’t click it yet.

| # | Dashboard click | Say (one line) |
|---|---|---|
| 1 | Sidebar → **Mocks** → search `trips` or `home` → open one row | “Recorded fixtures live here — this is what the app is eating.” |
| 2 | Open that mock: response body; note **Always use live API** if shown; glance field/date overrides if present | “We curate here instead of re-recording every edge case.” |
| 3 | Sidebar → **Settings** → scenario switcher / create scenario; scroll to **Client lanes** | “Scenarios are whole worlds. Lanes bind a client id to a scenario (needs redis/sqlite).” |
| 4 | Sidebar → **Date Config** | “Clock for demos/tests — pairs with `getCurrentDate()` in the app.” |
| 5 | Sidebar → **Network** → ensure **Logging on**; optionally **Bodies on** | “Multi-hop traffic shows up here after proxy calls.” |
| 6 | Sidebar → **Fixture pool** | “Promote a list once; later scenarios reference it (`$pool`) instead of copying JSON.” |
| 7 | Sidebar → **Settings** again only if needed for record-on-miss / proxy notes | “Proxy miss/record knobs live with the shared store — we’ll use them when we capture.” |

Optional glance (skip if timeboxed): **Statistics**, **Timeline**.

### SHOW (dual surface)

| App | Dashboard |
|---|---|
| My Trips stays up, untouched | Walk the table above left → right in the sidebar |
| — | End on **Mocks** or **Network** so the next beat has a familiar landing spot |

### INVARIANT

Audience can name **Mocks, Settings (scenarios + lanes), Date Config, Network, Fixture pool** before you change any data.

### SAY

*“Left side is the product. Right side is how we operate the API world — next prompts change state; this tour does not.”*

---

# 04 · Record a golden happy path

**Goal:** Capture traffic once; prove replay; **see the recording appear in the Dashboard**.

**Mode A/C (seeded):** usually **skip the prompt** — mocks already exist. Use the SHOW table only (prove replay).  
**Mode B / first capture:** use the prompt for env/commands + post-capture file summary (agent discovers real filenames).

### PROMPT (copy) — Mode B / first capture only

```text
Help me record a golden default scenario for this trips app.

1. Set MOCKIFYER_RECORD=true (and/or dashboard record-on-miss for proxy mode) on the right processes.
2. Print exact commands to start Redis + Dashboard + app stack.
3. After I manually click: login as Alice → My Trips → home/detail, I will say "done".
4. Then set guidance for RECORD=false, list new files under mock-data/default (or active scenario), and one-line summarize each endpoint (method + path + purpose).

Do not give me a Dashboard click tour — I already know Mocks. Just summarize what landed on disk / in the store.
```

### SHOW (you drive the clicks either way)

| App | Dashboard |
|---|---|
| Record on → Alice happy path once *(or skip if seeded)* | Mocks list shows trips/home/bookings (refresh if needed) |
| Record off → reload My Trips — still works | Open trips mock → real response JSON |
| Optional: kill upstream seed; reload again | Note “Always use live API” on a fresh recording if present |

### INVARIANT

- Replay works without live upstream.
- The same fixture is visible as a **Dashboard mock row**, not only a git file.

---

# 05 · Use the product (presenter script — no prompt)

**Goal:** Let them believe it’s a real app; keep Dashboard as the “source of truth” glance.

### SHOW (you drive — no agent)

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
Using mockifyer-mcp (prefer tools over hand-editing JSON), create product scenarios derived from default:

1. check-in-open — one CONFIRMED trip can show the check-in CTA
2. empty-trips — My Trips empty state
3. booking-error — bookings hop fails (e.g. 503) while trips still load (if home merge exists)

For each: create with deriveFrom: "default" when possible; prefer responseFieldOverrides / responseDateOverrides over huge JSON copies; adapt trip ids/filenames to what exists in mock-data.

Do not redesign the UI. Do not narrate Dashboard navigation — just create/configure the scenarios.
```

### SHOW (you switch / prove)

| App | Dashboard |
|---|---|
| Refresh after each switch | Settings → scenario → `empty-trips` |
| Empty state visible | Mocks under that scenario |
| Switch → `check-in-open` → CTA on | Scenario control shows name |
| Back to `default` → full list / CTA off | Scenario back to default |

### INVARIANT

Same binary; worlds change from the **Dashboard scenario control** (or lane — later), not a frontend feature flag.

---

# 07 · Bend time / fields (overrides) in the Dashboard

**Goal:** Calendar + field control without re-recording — edited where operators live.

### PROMPT (copy)

```text
In scenario check-in-open, make check-in open using Mockifyer overlays — do not re-record.

1. Inspect the trips list mock with mockifyer_get_mock_ai_context (adapt filename).
2. Apply responseDateOverride so the chosen trip departureAt is ~10h from Mockifyer "now" (mockifyer_set_field_overrides / date override tools or dashboard API).
3. Ensure status CONFIRMED via field override if needed.
4. Confirm in code that the app check-in rule uses getCurrentDate() (report file path only).

Do not give a Dashboard click tour — I will show overrides in the UI myself after you apply them.
```

### SHOW (you flip for contrast)

| App | Dashboard |
|---|---|
| CTA **on** after agent applies overlays | Mocks → trips mock → overrides / date fields visible |
| You flip/clear override or Date Config → CTA **off** | Same panel — no new recording timestamp |
| — | Emphasize: curated overlay, not re-capture |

### INVARIANT

UI clock + payload timestamps stay aligned; Dashboard shows the override as the mechanism.

### SAY

*“We didn’t wait for a real departure window — and we didn’t hand-edit a mystery JSON path in the dark.”*

---

# 08 · Parallel lanes (Dashboard Client lanes + two app tabs)

**Goal:** Isolation for E2E / multi-tester — bind via MCP (or you in Settings); prove in two browsers.

### PROMPT (copy)

```text
Using mockifyer_set_client_lane_scenario / mockifyer_list_client_lanes, bind:

- trips-e2e-stable → default (or qa-stable)
- trips-e2e-checkin → check-in-open
- trips-e2e-empty → empty-trips

Then list lanes to confirm. Do not narrate Dashboard navigation.
Optional: sketch Playwright projects 1:1 with those client ids (config snippet only).
```

### SHOW (you open the two tabs)

| App | Dashboard |
|---|---|
| Tab A `MOCKIFYER_CLIENT_ID=trips-e2e-stable` → default world | Settings → **Client lanes** shows bindings |
| Tab B `trips-e2e-checkin` → CTA on | Point at lane → scenario; no process restart |
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
Compose check-in-open from a shared fixture pool (no duplicated trip blobs). Use MCP tools:

1. mockifyer_promote_response — promote default Alice trips-list (clear id, e.g. trips-list-alice); adapt filename from mock-data.
2. mockifyer_preview_pool_ref — document mode, keep envelope, select only the check-in candidate trip by id.
3. mockifyer_set_pool_ref — set that ref on the check-in-open trips mock.
4. Re-apply ~10h departure overlay on the resolved path.
5. mockifyer_set_client_lane_scenario — trips-e2e-checkin → check-in-open.

Report the pool id, selected trip id, and mock filename you changed. No Dashboard click tour.
```

### SHOW (you verify in UI)

| App | Dashboard |
|---|---|
| Check-in lane → CTA still works | **Fixture pool** → promoted id once |
| — | Mocks → `check-in-open` trips mock → **`$pool` node** |
| — | Optional: show agent preview output beside Dashboard |

### INVARIANT

One canonical pool fixture; scenario is composition; app still shows the product state.

### SAY

*“Fixtures are a library. Scenarios are composition. Dashboard is where you see both.”*

---

# 10 · Trace in Dashboard Network (+ chaos)

**Goal:** Multi-hop “who failed?” — you drive Network UI; agent fetches/explains the trace and flips chaos.

### PRESENTER SCRIPT (before the prompt)

1. Dashboard → **Network** → **Logging on**; optionally **Bodies on**.
2. App → trigger Home / aggregate once.
3. Stay on Network so the new event is visible.

### PROMPT (copy) — after you clicked Home

```text
I just triggered the app home/aggregate call. Using mockifyer_list_network_events and mockifyer_get_network_trace:

1. Find the latest requestId for that call and summarize ordered hops (service/path/status/duration).
2. If provenance is available, say which hop owned a visible field (e.g. destination title).
3. Then switch to booking-error (scenario or lane trips-e2e-* if bound), and tell me when to re-trigger Home.
4. After I re-trigger, pull the new trace and highlight the failing bookings hop.

No Dashboard navigation guide — Network is already open.
```

### SHOW

| App | Dashboard |
|---|---|
| Home already triggered; re-trigger after chaos | **Network** → event → hops match agent summary |
| Flip visible after `booking-error` | Bookings hop red/503; trips still ok in app |

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

Bind lane trips-e2e-improv → demo-improv. Report scenario name, mock filename, and lane binding.
Explain briefly how to delete/archive afterward (tool or Settings). No UI click tour.
```

### SHOW (you verify)

| App | Dashboard |
|---|---|
| Improv lane → two rows, one cancelled | Settings scenarios + Mocks detail show edits/`$pool` |
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

Prompts only (skip presenter-only slides 03 and 05):

**A1** Create app — slide 01  
**A2** Wire Mockifyer + Dashboard — slide 02  
**A3** Record golden — slide 04  
**A4** Scenarios — slide 06  
**A5** Overrides / time — slide 07  
**A6** Lanes — slide 08  
**A7** `$pool` compose — slide 09  
**A8** Network trace + chaos — slide 10  
**A9** Improv — slide 11  

Slide **03** = fixed Dashboard tour script (no prompt). Slide **05** = product walkthrough (no prompt).  

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
5. **One prompt → one SHOW on both panes → breathe** (skip inventing prompts for presenter-only slides).
6. **Don’t prompt the Dashboard tour** — slide 03 is you presenting; agent prompts earn their place when state must change (record / scenarios / overrides / lanes / pool / trace).
7. **Success metric** — audience can open Dashboard next week on *their* app and switch a scenario while their UI updates.
