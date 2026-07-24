# Mockifyer Prompt-as-You-Go Demo

Live presentation you can **run by copying prompts** into Cursor (or any agent with `mockifyer-mcp` + repo tools). Each slide is one beat:

1. **Copy the prompt**
2. **Wait for the agent to finish**
3. **Show** the app / dashboard / outcome listed on the same slide
4. **Advance** to the next prompt

Trips Showcase nouns are the default example. The deck is written so the **same beats** still prove Mockifyer’s purpose when the UI, destinations, ports, or filenames look different.

**How to read:** each `---` is a slide. Grey boxes labeled `PROMPT` are copy-paste. `SHOW` is what you click/narrate after the prompt. `INVARIANT` is what must still be true for the beat to count.

## Document set

| Doc | Role |
|---|---|
| [`trips-showcase-prompt-demo.md`](./trips-showcase-prompt-demo.md) | **This file** — prompt → show → next prompt |
| [`trips-showcase-adoption-presentation.md`](./trips-showcase-adoption-presentation.md) | Capability adoption slides |
| [`trips-showcase-demo.md`](./trips-showcase-demo.md) | Prospect Acts 1–4 (no agent required) |
| [`trips-showcase-presentation.md`](./trips-showcase-presentation.md) | Technical `$pool` / curl deck |
| [`trips-showcase.md`](./trips-showcase.md) | Build plan |

**Ships as:** `example-projects/trips-showcase/docs/PROMPT_DEMO.md`

---

# 00 · Can you replicate this live? (presenter notes)

**Short answer: yes — if you demo *behaviors*, not pixels.**

A live agent-built demo will rarely produce the same layout, copy, or trip cities twice. That is fine. Mockifyer’s purpose is not “pretty NYC cards”; it is:

| Purpose (must show) | Surface noise (may differ) |
|---|---|
| HTTP is intercepted; record → replay | Exact Vite theme, port numbers |
| Product **worlds** swap via scenarios | Scenario names (`check-in-open` vs `ready-to-board`) |
| Time / fields bend without re-record | Exact `offsetHours`, field paths |
| Parallel clients don’t stomp each other | Client id strings |
| Multi-hop “who failed?” is visible | Number of services (2 vs 5) |
| Shared fixture + compose (optional headline) | Pool id / select values |

### Replicability contract (use this when the app looks “wrong”)

```text
OK if:  cities, CSS, login labels, filenames, ports differ
FAIL if: you cannot switch a product state without redeploying stubs
FAIL if: two clients cannot see different scenarios on one stack
FAIL if: you cannot point at a recorded JSON (or dashboard mock) as the source of truth
```

### Demo modes

| Mode | When | Prep |
|---|---|---|
| **A — Seeded (safest live)** | Conference / customer call | Pre-built `trips-showcase` + `restore-demo.sh`; prompts only for compose/lanes/trace |
| **B — Prompt-from-scratch** | Workshop / internal | Longer; accept visual variance; stick to invariants |
| **C — Hybrid (recommended)** | Most demos | Pre-scaffold app + mocks; prompts for scenarios / `$pool` / lanes / trace |

**Recommendation:** sell with **Mode C**. Mode B proves “agent can build,” but Mode C proves Mockifyer even when the agent invents different UI chrome.

### Timing

| Path | Slides | ~Duration |
|---|---|---|
| Fast | 01 → 03 → 05 → 07 → 09 | 8–12 min (seeded stack) |
| Full | 01–11 | 25–40 min (agent build + compose) |
| Fail-safe | Skip 01–02; start at 03 with restore | Always available |

---

# 01 · Create a useful trips-like application

**Goal:** Get a runnable product shell with login, list, detail, and a date-based CTA rule — enough surface for Mockifyer to matter.

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

### SHOW (after prompt completes)

1. `npm install && npm run dev` (or whatever README says).
2. Login as Alice → **My Trips** lists several destinations.
3. Open one trip → detail renders.
4. Point at the check-in rule in code (`getCurrentDate`, ≤10h) — CTA may be off; that is OK.
5. Say: *“This is a normal app. Next we make its API world controllable.”*

### INVARIANT

- UI talks to an HTTP API (or BFF), not only in-memory React state.
- Check-in rule is centralized on a swappable clock helper.

### If the app looks different

Different fonts, cities, or “Board now” instead of “Check-in” is **success**, as long as list + time-gated CTA + HTTP boundary exist.

---

# 02 · Wire Mockifyer into that app

**Goal:** Intercept outbound HTTP; point at a shared `mock-data` folder; optionally dashboard proxy.

### PROMPT (copy)

```text
Wire Mockifyer into this trips app and its API/BFF processes.

Requirements:
1. Install @sgedda/mockifyer-core and @sgedda/mockifyer-fetch (or axios if the services use axios).
2. Bootstrap Mockifyer once per process that issues HTTP — prefer initMockifyerForLocalFilesystem for a simple first run; if Redis/dashboard is easy, also document initMockifyerForDashboardProxy.
3. Use MOCKIFYER_PATH=./mock-data, MOCKIFYER_SCENARIO=default, MOCKIFYER_RECORD env flag.
4. Replace business-rule clocks with getCurrentDate from the same Mockifyer package used for setup.
5. Add short README section: how to record (MOCKIFYER_RECORD=true), how to replay (false), where JSON lands.
6. Do not change product screens except as needed for bootstrap.

Show me the exact bootstrap snippet and env vars to export.
```

### SHOW

1. Open the bootstrap file — one `setup` / `init…` call before fetches.
2. Confirm `getCurrentDate()` import in the check-in rule.
3. Show empty or ready `mock-data/` path in the tree.
4. Optional: start dashboard (`npx mockifyer-dashboard …`) and open `:3002`.

### INVARIANT

- At least one process that performs HTTP is patched.
- Replay/record is env-driven; mock path is shared.

### SAY

*“Product code stayed the product. Mockifyer sits on the wire.”*

---

# 03 · Record a golden happy path

**Goal:** Capture real (or seed-server) traffic once so demos no longer need that backend.

### PROMPT (copy)

```text
Help me record a golden default scenario for this trips app.

1. Set MOCKIFYER_RECORD=true for the API/BFF (and any upstream services that should be captured).
2. Tell me the exact commands to start the stack.
3. Give me a short manual script: login as Alice → open My Trips → open home/detail if present.
4. After recording, set RECORD=false and confirm which JSON files appeared under mock-data/default (or the active scenario).
5. Summarize each recorded endpoint in one line (method + path + purpose).
```

### SHOW

1. Run the agent’s start commands with **record on**; click through Alice’s happy path once.
2. Open `mock-data/default/` (or dashboard Mocks list) — real response bodies for trips/home/etc.
3. Restart with **record off**; reload My Trips — **same UI without hitting live upstream**.
4. Optional: stop/kill upstream seed servers and reload again (strongest beat).

### INVARIANT

- After record→replay, the list/detail still renders from fixtures.
- Files (or dashboard entries) are visibly the source of truth.

### REPLICABLE TIP

If recording against public APIs fails on Wi‑Fi, fall back to **seed Express handlers** in-repo, record those once, then kill them for the replay beat. Purpose unchanged.

---

# 04 · Show the app as a product (pause — no new prompt)

**Goal:** Let the audience *use* the app before more Mockifyer magic — sells “this is real software.”

### SHOW (presenter drives; no agent required)

| Click | Narrate |
|---|---|
| Login Alice | Normal auth surface |
| My Trips | Multi-item list from fixtures |
| Trip detail | Nested fields from same world |
| Bob (optional) | Different user / empty — if seeded |
| Refresh with backends down | “Demo doesn’t need staging today” |

### SAY

*“Everything from here is changing the API world under this UI — not rewriting the React tree.”*

### INVARIANT

Audience believes the app is usable. If UI is ugly but navigable, continue.

---

# 05 · Create product-state scenarios

**Goal:** Whole-world switches — not one boolean in the frontend.

### PROMPT (copy)

```text
Using Mockifyer (dashboard HTTP or mockifyer-mcp), create product scenarios derived from default:

1. check-in-open — Alice should be able to see a check-in CTA for one upcoming CONFIRMED trip.
2. empty-trips — My Trips shows an empty state.
3. booking-error — if the app has a bookings hop / home merge, bookings should fail (e.g. 503) while trips still load.

For each scenario:
- create with deriveFrom: "default" when possible
- explain which mock file(s) you will change
- prefer responseFieldOverrides / responseDateOverrides over duplicating huge JSON
- tell me how to activate each scenario (env, dashboard switch, or client lane)

Do not redesign the UI. Adapt names if our trip ids differ — pick whatever id exists in the recorded list.
```

### SHOW

1. Dashboard → scenarios list includes the new names (or `mock-data/<scenario>/` folders).
2. Switch to `empty-trips` → refresh UI → **empty state**.
3. Switch to `check-in-open` → refresh → **CTA visible** on one trip.
4. Switch back to `default` → CTA off / full list again.

### INVARIANT

- Same binary, different worlds, no redeploy of stub servers.
- Scenario change is visible in UI within a refresh (or live if demo panel exists).

### If data differs

Agent may pick `trip-paris-…` instead of NYC. Point at **CTA appearing/disappearing**, not the city name.

---

# 06 · Bend time / fields (overrides)

**Goal:** Prove calendar + field control without re-recording.

### PROMPT (copy)

```text
In scenario check-in-open (or create it if missing), make check-in open using Mockifyer overlays — do not re-record.

1. Inspect the trips list mock (prefer mockifyer_get_mock_ai_context).
2. Set a responseDateOverride (or equivalent) so the chosen trip's departureAt is about 10 hours from Mockifyer "now".
3. Ensure status is CONFIRMED via field override if needed.
4. Confirm the app check-in rule uses getCurrentDate().
5. Tell me how to flip "now" or the override so the CTA turns off again for contrast.
```

### SHOW

1. With overlays applied → CTA **on**.
2. Flip override / clock (dashboard date config or second override) → CTA **off**.
3. Open the mock in dashboard — show override paths, not a brand-new recording timestamp.

### INVARIANT

- UI clock and payload timestamps stay aligned via `getCurrentDate()` + overrides.
- No new capture required for the on/off contrast.

### SAY

*“We didn’t wait for a real flight window. Time is a first-class control.”*

---

# 07 · Parallel lanes (two worlds, one stack)

**Goal:** E2E / multi-tester isolation — the “don’t stomp my fixtures” beat.

### PROMPT (copy)

```text
Set up Mockifyer client lanes for this trips demo (Redis/dashboard proxy assumed).

1. Ensure dashboard runs with a provider that supports client lanes (redis).
2. Bind:
   - clientId trips-e2e-stable → scenario default (or qa-stable)
   - clientId trips-e2e-checkin → scenario check-in-open
   - clientId trips-e2e-empty → scenario empty-trips
3. Tell me how to open two browsers/tabs with different MOCKIFYER_CLIENT_ID / X-Mockifyer-Client-Id.
4. Optionally sketch Playwright projects mapping 1:1 to those client ids.

Use mockifyer_set_client_lane_scenario / list_client_lanes if MCP is available.
```

### SHOW

1. Tab A (`trips-e2e-stable`) → full list, no CTA (or default world).
2. Tab B (`trips-e2e-checkin`) → CTA on — **same machine, same stack**.
3. Dashboard Client lanes UI shows both bindings.
4. Optional: mention Playwright project names without running the suite.

### INVARIANT

Two concurrent clients → two scenarios → no global env restart fight.

### Fail-soft

If Redis isn’t available live, **say** the lane story and show a screenshot / pre-recorded GIF; don’t derail the talk debugging Docker. Purpose still taught; proof deferred.

---

# 08 · Compose from a shared pool (`$pool`)

**Goal:** Headline DRY story — one promoted list, many scenarios by ref + select + overlays.

### PROMPT (copy)

```text
Compose check-in-open from a shared fixture pool (do not keep duplicated trip blobs).

1. Promote the default Alice trips-list response into the fixture pool (id like trips-list-alice — use a clear id).
2. Preview a $pool document ref that keeps the envelope but selects only the check-in candidate trip (by id field).
3. Set that $pool ref on the check-in-open trips mock.
4. Keep/re-apply the ~10h departure overlay on the resolved path.
5. Show me the scenario mock body — it should reference $pool, not paste the full trips array.
6. Bind lane trips-e2e-checkin → check-in-open and tell me how to verify in the app.

Adapt filenames/ids to whatever exists in this repo's mock-data.
```

### SHOW

1. Dashboard / disk: `mock-data/pool/responses/<id>.json` exists once.
2. Open `check-in-open` trips mock → **`$pool` node** visible.
3. Preview resolve (agent output or dashboard) → single trip inside envelope.
4. App on check-in lane → CTA still works.
5. Optional: `git diff` style glance — scenario change is ref + overlays.

### INVARIANT

- One canonical list fixture; scenario holds composition instructions.
- UI still satisfies the check-in product state.

### SAY

*“Fixtures are a library. Scenarios are composition.”*

### If pool tools aren’t ready in the room

Fall back to slide 05–06 (scenarios + overrides). Still proves Mockifyer; pool is the **advanced** headline, not the only proof.

---

# 09 · Trace a multi-hop home call

**Goal:** Ops beat — “which service caused this?”

### PROMPT (copy)

```text
Help me demonstrate Mockifyer network tracing on this app's home/aggregate call.

1. Ensure network logging (and bodies if useful) is enabled on the dashboard.
2. Tell me which UI action or curl triggers the multi-hop chain (BFF → auth/trips/bookings/catalog — or whatever this app actually has).
3. After I trigger it, use mockifyer_list_network_events + mockifyer_get_network_trace (or curl) to show ordered hops with status and timing.
4. Point out which hop owned a visible UI field (e.g. destination title) if provenance is available.
5. Then switch to booking-error (scenario or lane), trigger home again, and show the failing bookings hop in the trace while trips still render.
```

### SHOW

1. Click Home / Run chain once → capture `requestId` (header, dashboard Network, or agent).
2. Trace view: ordered hops, statuses, durations.
3. Flip `booking-error` → Home degrades gracefully → trace highlights bookings failure.
4. Narrate: *same tooling for demos and incident rehearsal.*

### INVARIANT

- More than one hop appears **or** (single-service apps) the Network log still shows the outbound call + mock hit — adjust narration honestly.
- Chaos scenario fails a dependency without rewriting UI stubs by hand.

### Replicability note

A 2-service chain is enough. Don’t apologize for not having five microservices.

---

# 10 · Optional — agent-only “fix this state” improv

**Goal:** Show improvisation without leaving the Mockifyer workflow.

### PROMPT (copy)

```text
Without redeploying the app, create a short-lived scenario demo-improv derived from default where:
- the primary list shows exactly two items (use $pool select or overrides/copy_array_item — your choice)
- one item has status CANCELLED
Explain how to delete/archive this scenario after the demo.
Then bind a lane trips-e2e-improv → demo-improv so my other tabs stay untouched.
```

### SHOW

1. New lane/tab → exactly two rows; cancelled styling/status visible.
2. Other tab still on stable world.
3. Delete/unbind after applause.

### INVARIANT

Improvised product state via Mockifyer tools, not a hotfix branch.

---

# 11 · Closing slide (what to leave on screen)

### Purpose proven today

```text
Record real API worlds
  → Replay without backends
  → Switch scenarios (product states)
  → Bend time/fields (overrides + getCurrentDate)
  → Isolate clients (lanes)
  → Compose without duplication ($pool)
  → Explain multi-hop failures (traces)
```

### Copy-paste CTA for the audience

```text
Tonight in your repo:
1) init Mockifyer on the process that calls APIs
2) record one golden scenario
3) derive one “edge” scenario with overrides
4) if two people demo at once, add Redis client lanes
```

### Presenter fail-safes

| Problem | Move |
|---|---|
| Agent UI looks weird | Narrate invariants; don’t polish CSS live |
| Record failed | Use seed servers / restore-demo bundle |
| Redis down | Skip lanes; keep scenarios + overrides |
| Pool tools confuse room | Stop after scenarios + time bend |
| Timeboxed | Seeded Mode C: slides 04 → 05 → 06 → 07 |

### One-liner

> **If the screens look different but you still switched a product world, isolated a client, and pointed at a fixture — the demo worked.**

---

# Appendix A · Prompt pack (all prompts, no narration)

Use this appendix when you only need a cheat sheet.

**A1 — Create app** — see slide 01 `PROMPT`  
**A2 — Wire Mockifyer** — slide 02  
**A3 — Record golden** — slide 03  
**A4 — Scenarios** — slide 05  
**A5 — Overrides / time** — slide 06  
**A6 — Lanes** — slide 07  
**A7 — `$pool` compose** — slide 08  
**A8 — Trace + chaos** — slide 09  
**A9 — Improv** — slide 10  

---

# Appendix B · Domain swap table (keep purpose, change nouns)

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

When prompting, add one line:

```text
If this repo is not trips-themed, keep the same Mockifyer behaviors but rename scenarios and fields to match the domain you find in mock-data.
```

---

# Appendix C · Honest comments on live replicability

1. **Agent-built UI will drift** — treat slides 01–02 as workshop content; for sales, pre-build the app (Mode C).
2. **Data will drift** — prompts already say “adapt ids/filenames”; your SHOW column keys off CTA on/off, empty vs full, error vs ok — not “Rome must appear.”
3. **Infra will flake** — Redis, ports, Wi‑Fi: always have `restore-demo.sh` + a path that only needs filesystem replay.
4. **Purpose holds when invariants hold** — the table in slide 00 is the grading rubric; if you meet it, the talk replicated even if screenshots won’t match last week’s.
5. **Don’t demo three new things at once** — one prompt → one SHOW → breathe. The deck is ordered so each beat adds a single Mockifyer capability.
6. **MCP vs dashboard** — if MCP misbehaves, do the same beat in the dashboard UI; purpose identical, less “agent magic.”
7. **Success metric for you as presenter** — audience can repeat Appendix A prompts 4–7 against *their* app nouns next week.
