# Demo runbook — Mockifyer DevEx (30 min)

Companion to [mockifyer-devex.md](./mockifyer-devex.md). Lab: [CODE_LAB.md](./CODE_LAB.md).

## Your talk order (locked)

1. Short **background** — why / how it started  
2. **Packages** — what each is for  
3. **How it runs** — per repo, **acctest only**, **off by default**, enable via **RN app**  
4. **Demo tracking first** — Metro key **`t`** → trace, nested calls, search  
5. **Switch scenario** in the app + **dashboard** under the hood  
6. **MCP** example (short; deeper in lab)  
7. Optional “if I missed…” beats → **code lab**

## Prep checklist

- [ ] RN app on **acctest** with Mockifyer wired; starts **disabled**; Dev toggle to enable  
- [ ] Metro TTY in foreground (so **`t`** works) — Atlas key default `t`  
- [ ] Dashboard + Redis (lanes/scenarios shared across services you demo)  
- [ ] Scenarios ready: e.g. `trips-empty`, `trips-one`, `trips-many`, `checkin-open`  
- [ ] Screenshots/clips: toggle on, Atlas/`t` nested tree, Search hit, in-app scenario flip, dashboard lane/scenario  
- [ ] Optional: MCP client pointed at dashboard for a 30s prompt  

## Timing (~30 min)

| Min | Block |
|-----|--------|
| 0–4 | Background (system → booking hack → drift → intercept) |
| 4–7 | Packages table |
| 7–11 | Activation: per repo, acctest, off→on in RN |
| 11–18 | **Demo A:** enable app → press **`t`** → nested trace → search |
| 18–24 | **Demo B:** switch scenario in app → show dashboard lane/mocks/Network |
| 24–27 | MCP one prompt (or screenshot) |
| 27–30 | Missed-one-liners (optional) + handoff to lab |

## Stage script

### 1–3 · Story + packages + activation
- Keep background short (3–4 min max).  
- Packages: name + one job each; Node / RN / React web one breath.  
- Stress: **not prod** · **acctest** · **inactive until RN enable** · add package where you want record/track/mock.

### 4 · Tracking first (`t`)
1. Enable Mockifyer in the RN app.  
2. In **Metro terminal**, press **`t`** (starts Atlas capture + live stream).  
3. Use the app so traffic flows.  
4. Show **nested / correlated** hops (expand/collapse).  
5. Show **search** (Atlas HTML Search and/or stream links to bodies).  

**Fallback:** Dashboard **Network** Live + Expand if Metro `t` fails; Atlas HTML from a prior session for Search.

**Note:** `a` is reserved for Android in Metro — Atlas default is **`t`**.

### 5 · Scenario in app + dashboard
1. Flip `trips-empty` → `trips-one` (etc.) in app Dev UI.  
2. Dashboard: active scenario / **client lane**, mock list for that world, Network hops for the lane.  
3. Say once: **runtime on/off ≠ scenario**; **lane** = who; **scenario** = which world.

### 6 · MCP
One prompt only, e.g. “Set my lane to `trips-empty`” or an override. Rest in lab.

### 7 · If time — pick one
- How a world is born (record → passthrough → curate)  
- REST vs GraphQL matching  
- Allowlist / `excludedUrls`  
- Date offset or booking-number array override  
- Maestro `mockifyerClientId` + `scenario`  

## Fallbacks

| Fails | Do this |
|-------|---------|
| `t` / Atlas TTY | Dashboard Network + prebuilt Atlas HTML |
| In-app flip | Screenshots + dashboard scenario switch |
| MCP | Screenshot of tool call |
| Redis hops empty | Single-service Network is enough; explain multi-service as “when connected” |

## Cut order if over

1. MCP → screenshot only  
2. “Missed” table → skip  
3. Search → one screenshot  

**Never cut:** background (short), activation (acctest / off-by-default), **`t` + nested**, scenario flip + dashboard.
