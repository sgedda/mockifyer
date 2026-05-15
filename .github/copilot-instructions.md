# Mockifyer monorepo

This repository implements **Mockifyer**: record and replay HTTP traffic for **axios** and **fetch**, with scenarios, optional date manipulation, a local **dashboard**, and React Native support.

## Where to look

- **Product overview & env vars**: [README.md](../README.md)
- **Deep agent guide** (matching, dashboard, RN): [.github/instructions/mockifyer.instructions.md](./instructions/mockifyer.instructions.md)
- **Cursor skill** (same repo): [.cursor/skills/mockifyer/SKILL.md](../.cursor/skills/mockifyer/SKILL.md)

## Packages (publish these, not the root)

- `@sgedda/mockifyer-core` — matching, providers, scenarios, dates
- `@sgedda/mockifyer-axios` / `@sgedda/mockifyer-fetch` — `setupMockifyer`
- `@sgedda/mockifyer-dashboard` — UI + `/api/*`

## Coding expectations

- TypeScript strict, async/await, meaningful names, no silent failures
- Prefer interfaces for object shapes; avoid `any` unless necessary
- Do not commit or push unless the user explicitly asks
- When changing `packages/mockifyer-dashboard`, run frontend + `build:backend` before opening a PR

## Mock matching (do not guess)

Request identity uses `generateRequestKey` in `packages/mockifyer-core/src/utils/mock-matcher.ts`. GraphQL keys use **normalized query + sorted variables**, not headers or `operationName` alone.
