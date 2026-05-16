# Mock data workflow: recording, curation, and re-recording

Mockifyer makes it easy to **capture real traffic** and **replay** it. Teams also **edit** saved JSON (responses, date overrides, anonymization). Those two activities have different goals:

| Activity | Goal |
|----------|------|
| **Record / re-record** | Match what the backend (or proxy) returned *now* — good for contract drift and “make it real.” |
| **Curate** | Shape payloads for stable demos, edge cases, and tests — good for predictable UI and CI. |

**Replacing or deleting a mock to force a new recording will discard curation** unless you treat that as a deliberate, recoverable step. This doc is a **team workflow** for that tradeoff — not a requirement of the tools.

Technical setup lives in **[MOCKIFYER_INITIALIZATION.md](./MOCKIFYER_INITIALIZATION.md)** and the **dashboard** [README](./packages/mockifyer-dashboard/README.md).

---

## 1. Split “truth from the wire” from “what we want the app to see”

Use **separate scenarios** (or branches) instead of one folder that tries to do everything:

| Scenario role | Typical name examples | Contents |
|---------------|------------------------|----------|
| **Raw / recorded** | `recorded-main`, `from-staging-2026-01`, `redis-dump` | Mostly auto-recorded; acceptable to overwrite when refreshing from APIs. |
| **Curated / product** | `demo`, `empty-state`, `checkout-error`, `qa-stable` | Hand-edited goldens; **do not** bulk re-record over without review. |
| **Scratch** | `local-alice`, `pr-123` | Short-lived; safe to delete. |

**Rule of thumb:** if someone spent time editing a file for a demo or test, that mock should live in a **curated** scenario (or be protected by your review process), not only in a “recorded” scenario you refresh weekly.

---

## 2. Before you re-record or delete a mock

1. **Know which scenario you are in** (`MOCKIFYER_SCENARIO`, dashboard lane, or `scenario-config.json`).
2. **Decide if this mock is “curated.”** If yes, do not delete in place without a backup path (below).
3. **Prefer git to snapshots:** commit (or stash) the current `mock-data` tree so you can diff and restore edits.
4. **Optional:** copy the scenario or specific files to `_archive/` or a dated branch before a bulk refresh.

---

## 3. GraphQL and “same endpoint, different body”

GraphQL often shares one URL; **matching** uses the request (including body / variables). So:

- A **changed query or variables** can produce a **new** mock file — that is expected.
- If the **operation is the same** but you need a **new response** from the server, you still may hit the **same stored mock** until you remove or replace that entry (or use a scenario that does not contain it).

Treat **operation + variables** (and any matching options your team uses) as part of the mock identity, not just the path.

---

## 4. Same request key, new real response — recovery patterns

When the backend contract moves but the **request** is unchanged, re-recording **overwrites** the previous JSON. To **not** lose curation accidentally:

### A. Fork first, merge with intent

1. Duplicate the relevant mocks or scenario (copy folder, or export/import via dashboard if you use bundles).
2. Re-record into the **copy** or into `recorded-*`.
3. Manually merge: bring **intentional** edits (comments in PR, date overrides, redacted fields) into the new payload after reviewing the wire diff.

### B. Use git as the safety net

Re-recording then `git diff` shows exactly what the wire changed vs what you had edited. **Resolve** like a code review: re-apply only the edits you still want on top of the new response.

### C. Avoid “delete to refresh” on curated paths

For goldens that matter, prefer **new scenario** or **new file name** (if your tooling allows multiple matches) over deleting the only copy.

---

## 5. What to delete vs what to duplicate

| Situation | Safer approach |
|-----------|----------------|
| Wrong recorded data, **not** hand-tuned | Delete mock or re-record in a **recorded** scenario. |
| Hand-tuned demo / E2E golden | **Duplicate scenario** or copy file to `_archive/` / git branch, then refresh. |
| Experimenting | Use a **scratch** scenario; delete freely. |

---

## 6. Redis, proxy, and disk (team setups)

If you use **dashboard + Redis** and **mirror to disk** (or **client mirror**), the same workflow applies: the **canonical curated** copy is still whatever you **commit** under `mock-data`. Treat Redis as **shared runtime**; treat **git-tracked JSON** as **reviewed** unless your team explicitly uses Redis-only goldens.

---

## 7. Lightweight conventions (pick what fits)

- **Naming:** encode intent in scenario names (`recorded-*`, `demo-*`, `stable-*`).
- **PRs:** any change under `mock-data/**` in a curated scenario gets a **short note** (“refreshed from staging; re-applied date overrides on line …”).
- **Ownership:** one role (or rotation) responsible for **periodic** refresh from `recorded-*` into `stable-*` so frontend does not silently diverge.

---

## 8. When you might extend the *tool* later (optional)

Workflow fixes most pain. Product ideas that **complement** this doc (not required today):

- Re-record with **merge rules** (keep selected JSON paths).
- **Versioned** mocks per hash or explicit `v2` files.
- Dashboard **duplicate before replace** or history.

---

## See also

- [MOCKIFYER_INITIALIZATION.md](./MOCKIFYER_INITIALIZATION.md) — presets, proxy, filesystem vs Redis.
- [packages/mockifyer-dashboard/SCENARIO_IMPORT_EXPORT.md](./packages/mockifyer-dashboard/SCENARIO_IMPORT_EXPORT.md) — moving scenarios between environments.
- [.cursor/plans/contract-drift-detection.md](./.cursor/plans/contract-drift-detection.md) — ideas around drift (complementary to refresh workflow).
