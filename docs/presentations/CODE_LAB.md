# Code lab — after the 30 min Mockifyer talk

Hands-on continuation of [mockifyer-devex.md](./mockifyer-devex.md).  
**Eng-leaning.** Destination / QA can stay on Exercise 1 (and watch 2).

## Lab prep (facilitator)

- Shared RN/Expo app **or** `example-projects/react-native-expo-example` (or clerk variant)
- Dashboard: `npx mockifyer-dashboard` with Redis or SQLite; starter scenarios loaded
- Metro with Mockifyer middleware; `MOCKIFYER_MODE` set deliberately (`manual` or `on` for lab)
- Optional: Cursor MCP pointed at dashboard ([`packages/mockifyer-mcp/README.md`](../../packages/mockifyer-mcp/README.md))
- Optional: Maestro + `react-native-launch-arguments` ([`example-projects/maestro-login-flow`](../../example-projects/maestro-login-flow))

Docs: [REACT_NATIVE.md](../../REACT_NATIVE.md) · [MOCK_WORKFLOW.md](../../MOCK_WORKFLOW.md) · [MOCKIFYER_INITIALIZATION.md](../../MOCKIFYER_INITIALIZATION.md)

## Setup snippet (reference)

```typescript
import {
  setupMockifyerForReactNative,
  isMockifyerReactNativeActive,
} from '@sgedda/mockifyer-fetch';

const result = await setupMockifyerForReactNative({
  isDev: __DEV__,
  mockDataPath: 'mock-data',
  bundledDataPath: './assets/mock-data',
  useLaunchArgumentsClientId: true,
  // runtimeMode: 'manual', // opt-in via GUI
  // proxyBaseUrl: process.env.MOCKIFYER_PROXY_URL, // Redis dashboard
});

if (isMockifyerReactNativeActive(result)) {
  // result.instance.enableMockifyer() / disableMockifyer()
}
```

---

## Exercise 0 — Activate (acctest / opt-in)

**Goal:** Confirm Mockifyer starts off and only runs when you enable it (acctest).

1. Launch app — Mockifyer **inactive**.
2. Enable via RN Dev UI / runtime toggle.
3. Confirm traffic can be tracked/mocked only after enable.

---

## Exercise 1 — Track with Metro `t` (everyone can watch)

**Goal:** Nested calls + search (same as the talk demo).

1. With Metro TTY focused, press **`t`** to start Atlas capture / live stream.
2. Use the app so calls fire.
3. Expand / collapse nested hops; open a body.
4. Use **Search** (Atlas HTML) for a field the UI may not show.
5. Optional: press **`t`** again to stop; render/open HTML docs if you use that flow.

**Fallback:** Dashboard **Network** → Live → Expand.

**Check:** Network/Atlas live stream = *now*; Atlas HTML = map + search.

---

## Exercise 2 — Flip a world + dashboard under the hood

**Goal:** Scenario in app ↔ dashboard.

1. Open the app Dev / scenario screen.
2. Switch to `trips-empty` → confirm UI; check dashboard lane/scenario + mocks.
3. Switch to `trips-one` → confirm UI + dashboard again.
4. Optional: `trips-many` or `checkin-open`.

**Check:** Runtime toggle off = no Mockifyer; scenario change = different world (not the same control).

---

## Exercise 3 — Birth a mock

**Goal:** Record → passthrough → curate → replay.

1. Enable record / record-on-miss for a path you care about (respect allowlist).
2. Trigger the call once — find the new mock in dashboard **Mocks**.
3. Confirm **Always use live API** (passthrough) if present — uncheck when ready to replay.
4. Reload the app with record off — UI should use the fixture.

**Check:** Prefer a **curated** scenario name for demos; don’t bulk re-record over it.

---

## Exercise 4 — Override (pick one)

**Goal:** Change a world without a full re-record.

### A — Date offset from now

1. Open Date Config / mock `responseDateOverrides`.
2. Set a check-in or departure field to **now + offset**.
3. Reload — UI should treat “today” correctly for that window.

### B — Extend booking numbers (array)

1. Find a trips/bookings array in a mock.
2. Clone an item (dashboard or MCP `mockifyer_copy_array_item`) and tweak a booking number.
3. Reload — list should show the extra item.

**Check:** This is the general form of the old “inject booking number” hack.

---

## Exercise 5 — Matching check (eng)

**Goal:** GraphQL ops don’t stomp each other.

1. Find two mocks that share the same `/graphql` (or similar) URL.
2. Compare request bodies — different `query` and/or `variables`.
3. Optional: change variables slightly and see a miss or new recording key.

**REST reminder:** method + URL + query (+ body hash for JSON POST).

---

## Optional tracks

| Track | Steps |
|-------|--------|
| **Maestro** | Copy YAML with `mockifyerClientId` + `scenario: trips-empty`; `maestro test …`; assert empty home. Remember: `launch_client` needs client id. |
| **MCP** | “Set my lane to `trips-empty`” / override a field / `copy_array_item`. |
| **Atlas Search** | Open Atlas HTML → Architecture/Map → Search a field unused by UI. |
| **Scope** | Peek `domain-path-rules.json` / allowlist; add an `excludedUrls` pattern for a noisy host. |

---

## Lab close (2 min, whole room)

- Predictable worlds for **demos, tests, and helping guests**
- Opt-in · curated for destination · off in store
- Builders: Network now, Atlas for the map

Questions → [mockifyer.dev](https://mockifyer.dev/) · repo packages under `packages/`
