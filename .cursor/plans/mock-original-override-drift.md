# Plan: Original response + override layer + keyed drift comparison

**Status:** Proposal / design — not implemented.

**Related:** [MOCK_WORKFLOW.md](../../MOCK_WORKFLOW.md) (team workflow), [.cursor/plans/contract-drift-detection.md](./contract-drift-detection.md), scenario import/export.

---

## Problem

Today a mock is effectively one **`response`** snapshot. Teams **re-record** or **edit** the same blob:

- **Re-record / replace** loses **curated** edits (anonymization, edge-case payloads, date tweaks).
- **Keeping only curated** loses a **canonical wire snapshot** to diff against when the real API moves (new fields, renames).

We want a model where **playback can stay curated** while **drift detection** compares **live API** to **what was originally recorded**, not to the merged fiction shown to the app.

---

## Core idea

1. **`responseOriginal`** (or equivalent) — immutable-ish “as captured from upstream” body (and headers if needed). Used as **baseline for comparison** when re-hitting the API.
2. **`responseOverride`** — optional partial tree (or patch semantics) applied on top for **replay** demos and tests.
3. **Effective replay** = merge rule applied to `responseOriginal` + `responseOverride` (specify rule: override wins by path, deep merge, etc.).
4. **Optional `comparisonKey`** (or path) — for **list / dataset** responses, identify **the same logical entity** so drift compares **one subtree** (e.g. `items[].id === "42"`) instead of whole paginated lists.

---

## Goals

| Goal | Notes |
|------|--------|
| Preserve curation | Overrides don’t replace the canonical original unless explicitly refreshed. |
| Meaningful drift | Compare **live** vs **original**, classify structural vs value-only (policy TBD). |
| List stability | Configurable key/path to align rows between snapshots. |
| Backward compatible | Existing mocks without new fields behave as today (`response` only). |

---

## Proposed on-disk / in-Redis shape (sketch)

Extend `MockData` (conceptually):

```text
response:            // keep for backward compat OR deprecate in favor of:
responseOriginal: { status, headers, data }
responseOverride?: { data?: … }   // partial; headers TBD
responseMergeMode?: 'override_wins' | 'deep_merge'   // default TBD

driftConfig?: {
  comparisonRoot?: JSONPath-like string   // e.g. $.data
  entityIdPath?: string                   // e.g. data.items[*].id or query variable name
  entityIdValue?: string | number         // optional fixed id; else infer from first record
  ignoredPaths?: string[]                 // timestamps, requestIds
}
```

Exact field names and nesting should align with existing `MockData` / dashboard editors — **one migration story** from single `response` → `responseOriginal` + empty override.

**Migration:**

- On read: if only `response` exists, treat it as `responseOriginal` and `responseOverride` empty.
- On first “split” action in dashboard: copy `response` → `responseOriginal`, initialize `responseOverride` `{}` or null.

---

## Replay semantics (must be specified)

Decide and document **one** default:

- **Override wins** at leaf paths (JSON Merge Patch style), or
- **Deep merge** with arrays replaced vs merged-by-key, or
- **Patch RFC 6902** (heavier).

Arrays are the sharp edge (replace entire array vs merge by `comparisonKey`). Recommendation: **merge list items by `id` when `entityIdPath` / key configured**, else **replace array** for v1.

---

## Drift flow (when “rehit” API)

1. Resolve mock for request (unchanged matching).
2. Optionally call **live** same request (or use last proxy upstream body).
3. Normalize both sides (strip `ignoredPaths`).
4. If **`comparisonKey`** configured: extract comparable subtrees from **live** and **`responseOriginal`**.
5. Produce diff / classification:
   - **Structural** — keys added/removed, type change at path.
   - **Value-only** — same paths, different scalars (policy: notify only, or auto-refresh original only, etc.).

**No auto-write in v1** — surface diff in dashboard or CI; human or explicit “apply refresh to `responseOriginal`”.

---

## Dashboard / UX (later phases)

- Editor tabs: **Original | Override | Effective (preview)**.
- Action: “Refresh original from live” (with diff preview).
- Action: “Move effective delta into override” (advanced).

---

## Implementation phases (suggested)

| Phase | Scope |
|-------|--------|
| **1** | Types + read-path compatibility: infer `responseOriginal` from `response`; document merge rule for effective body in **one** runtime path (fetch intercept). |
| **2** | Recording path: on proxy/fetch record, always set `responseOriginal`; optional empty `responseOverride`. |
| **3** | Pure **diff library** + CLI or dashboard “compare mock to clipboard / paste JSON” (no live call). |
| **4** | **Live** compare + `driftConfig` + `comparisonKey`; dashboard surfacing. |
| **5** | Redis + export/import parity for new fields (scenario bundles). |

---

## Open questions

- Store **full** `responseOriginal` headers or only body?
- GraphQL: bind `entityId` to **variables** (`id`) vs **response** path?
- Should `prepareMockResponseBody` / date overrides apply to **effective** only (yes, likely)?
- Lock / PR review: does touching `responseOriginal` require stricter review than override?

---

## Non-goals (for this plan)

- Automatic overwrite without user confirmation.
- Full JSON Schema / OpenAPI validation (can integrate later).
- Solving every polymorphic union edge case in v1.

---

## Success criteria

- Teams can **edit overrides** without losing a **single canonical original** for drift.
- List endpoints can opt into **keyed** subtree comparison with minimal false positives when ids are stable.
- Existing repos **without** new fields continue to work unchanged.
