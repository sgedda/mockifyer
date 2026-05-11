# Why Mockifyer is awesome

Short, honest value props you can reuse in README intros, internal decks, or npm package descriptions. Built around what the project **actually does**: intercept **axios** / **fetch**, **record** real traffic to **JSON**, **replay** with **scenarios**, control **time** for tests, and optional **dashboard** + **Redis** workflows.

---

## One-liner

**Record real APIs into versioned fixtures, switch whole worlds with scenarios, and freeze time—so native and Node apps can demo without backends and test in CI with the same data.**

---

## What makes it stand out

### 1. **Fixtures that matter are already real**
You capture **actual** requests and responses—not guessed handlers. That means demos and regression tests behave like production **payloads**, headers, and edge cases you really saw—without maintaining a parallel MSW/WireMock map of every route.

### 2. **Git is your review surface**
Mocks live as **JSON in the repo** (per **scenario** folders). PRs show what changed; reviewers see API behavior like code. That’s ideal for **golden datasets** and **team-owned** mock libraries.

### 3. **Scenarios = product states, not files scattered everywhere**
Switch **`MOCKIFYER_SCENARIO`** (or config) and you swap **entire** response sets: happy path, empty catalog, outage, stale auth—without redeploying a mock server or touching handler code for every screen.

### 4. **Deterministic time—not just “fake timers”**
**`getCurrentDate()`** plus fixed / offset / timezone (and **date overrides** on responses) lines up **app logic** and **mocked payloads** (JWT expiries, booking windows, subscriptions). Few mock stacks treat **calendar correctness** as a first-class feature.

### 5. **Native / React Native–friendly**
Built for **fetch** and **axios** in places where **Service Worker** MSW isn’t natural. **Expo / RN** patterns (hybrid provider, Metro sync) mean **simulators and devices** can share the same **record → sync → replay** loop as your IDE.

### 6. **Optional dashboard = curate, don’t just grep**
Browse, search, edit responses, **date config per scenario**, **client lanes**, Redis proxy controls—**ops for mock data** instead of only JSON editors. **Scenario locks** help treat goldens as **protected** artifacts.

### 7. **Same tool for two jobs you actually have**
- **Showcase / onboarding**: app runs with **no fragile backend** dependency.  
- **CI / automation**: same fixtures, **stable** and **reviewable**—especially with locks + date control + (planned) **network visibility** and **contract drift** checks.

---

## Compared in one sentence each

| Alternative | Mockifyer’s angle |
|-------------|-------------------|
| **MSW** | MSW shines when you **define** APIs in code; Mockifyer shines when you **preserve** real traffic as files and switch **scenarios** + **time**. |
| **WireMock** | WireMock is a great **HTTP server** for many stacks; Mockifyer stays **in-process** with **axios/fetch**, **RN**, and **repo-native** JSON workflows. |

---

## Who it’s for

- **Mobile / RN teams** that need **realistic** offline/demo behavior and **repeatable** E2E lanes.  
- **Teams** that want **recording** and **PR-reviewed** goldens without running Java infrastructure.  
- **Anyone** fighting **“tests pass but the API changed”**—especially when combined with **drift detection** and locked scenarios.

---

## Internal mantra (e.g. Ving)

**“One source of truth for how the app sees the API: record it, name the scenario, lock the golden, bend time when we need to.”**

---

## Not claiming (stay credible)

- Not trying to be the **universal** mock **server** for every language.  
- Not replacing **Pact**-style consumer contracts out of the box—**drift detection** is complementary.  
- **PII / secrets** still need discipline; recording power implies **redaction** and **policy** (roadmap, not magic).

Use this doc as **positioning**; keep **`README.md`** as the **technical** source of truth for setup and env vars.
