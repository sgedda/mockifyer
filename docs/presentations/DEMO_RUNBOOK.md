# Demo runbook — Mockifyer DevEx (30 min talk)

Companion to [mockifyer-devex.md](./mockifyer-devex.md). After the talk: [CODE_LAB.md](./CODE_LAB.md).

## Prep checklist

- [ ] RN / Expo app with in-app scenario (or lane) picker
- [ ] Metro running with Mockifyer sync middleware
- [ ] Dashboard with Redis (or SQLite) — shared lanes across services if you demo hops
- [ ] Four curated scenarios: `trips-empty`, `trips-one`, `trips-many`, `checkin-open` (or your names)
- [ ] Screenshots / clips ready for flips, record→passthrough, Network tree, Atlas Map/Search
- [ ] Maestro YAML on a slide (run in lab, not required live in talk)
- [ ] Atlas HTML from a prior session (fallback if live Map is slow)
- [ ] Backup screen recording of the four UI states

## Timing (≈30 min)

| Min | Block | Must land |
|-----|--------|-----------|
| 0–5 | Origin + needs + personas | Story → trip worlds → three audiences |
| 5–8 | Opt-in + runtime mode + filesystem→Redis | Opt-in; mode ≠ world; Redis between services |
| 8–10 | World is born | Record → passthrough → curate |
| 10–12 | Lane vs scenario | Plain gloss + Mermaid |
| 12–15 | Matching + scope | REST vs GraphQL; allowlist + `excludedUrls` |
| 15–20 | **Demo A** in-app flips | Empty → one → many → check-in |
| 20–22 | Maestro picture | YAML; predictability line |
| 22–26 | **Demo B** Network → Atlas | Live hops; then Map/Search; say the distinction |
| 26–29 | Dates + one override | Check-in today; date offset **or** booking-number array |
| 29–30 | Packages + handoff | Node · RN · React web → lab |

## Demo order (stage)

1. Origin narrative (slides; optional old-hack screenshot).
2. Opt-in / runtime mode (+ toggle screenshot if no live toggle).
3. Filesystem → Redis + dashboard (one Mermaid).
4. World born (screenshots OK — don’t burn time on a flaky live record).
5. Lane vs scenario Mermaid.
6. Matching + allowlist slides (no live coding).
7. **Live:** in-app flip through trip worlds. Say: toggle ≠ scenario.
8. Maestro YAML slide — “lab can try this.”
9. **Live:** Network expand nested hop → open body → handoff line → Atlas Architecture/Map (+ Search if time).
10. **Live or screenshot:** one override (prefer booking-number array if it echoes the origin story).
11. Packages / runtimes → “now we code together.”

## Fallbacks

| If this fails | Do this |
|---------------|---------|
| In-app flip | Four UI screenshots + dashboard lane/scenario switch |
| Live record | Mermaid + passthrough screenshot |
| Network empty | Pre-recorded hop tree clip |
| Atlas TTY | Skip TTY; use HTML Map/Search only |
| Override live | Before/after screenshot of array or date path |
| Maestro | YAML only — run in lab |

## Cut order if over time

1. Maestro → 1 slide, no talk beyond the YAML  
2. Atlas streaming terminal (keep HTML Map/Search)  
3. Second half of overrides slide (keep one use case)  

**Never cut:** origin, in-app flips, Network vs Atlas distinction.

## Mixed room cues

- After flips: “So what? Same worlds for demos, QA, and destination — without staging luck.”
- Before Network: “Builders lean-in — watch the movie either way.”
- Closing: zero env var names on the recap slide.

## Speaker accuracy notes

- RN: if `MOCKIFYER_MODE` is **unset**, library defaults to **`on`** — teach deliberate opt-in.
- `launch_client`: need non-empty **`mockifyerClientId`**; `scenario` alone does not activate.
- Passthrough: new recordings often `alwaysUseRealApi` until curated (`MOCK_WORKFLOW.md`).
