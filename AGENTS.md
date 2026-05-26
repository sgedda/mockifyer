# Mockifyer

## Cursor Cloud specific instructions

### Overview

Mockifyer is an npm-based monorepo (no npm workspaces — each package has its own `node_modules` and `package-lock.json`, linked via `file:` dependencies). Requires **Node.js 20.x** (engine field specifies `20.19.5`; use `nvm use 20.19.5`).

### Build order

Packages must be built in dependency order: `mockifyer-core` → `mockifyer-axios` → `mockifyer-fetch` → `mockifyer-dashboard`. Run `sh packages/build-all.sh` from the repo root (it handles `npm install` + `npm run build` for each).

### Running tests

- **Root-level unit tests**: `npm test` from `/workspace` (Jest + ts-jest, 20 suites, ~160 tests). The Jest config maps `@sgedda/*` imports to source via `moduleNameMapper`.
- **mockifyer-web tests**: `npm test` from `/workspace/mockifyer-web`.
- **E2E (Playwright)**: `npm run test:e2e` from `/workspace/mockifyer-web` (requires browsers installed via `npx playwright install`).

### Running the demo web app (`mockifyer-web`)

1. Create `/workspace/mockifyer-web/.env` from `.env.example` (minimum: `PORT=3000`, `MOCKIFYER_MODE=on`, `MOCKIFYER_RECORD=false`, `MOCKIFYER_PATH=./mock-data`). Real API keys (`WEATHER_API_KEY`, `FOOTBALL_API_KEY`) are optional — mock data is included.
2. Backend: `npm run dev` in `/workspace/mockifyer-web` (Express on port 3000, uses nodemon + ts-node).
3. Frontend: `npm run dev:frontend` in `/workspace/mockifyer-web` (Vite on port 5174).
4. Or both at once: `npm run dev:all`.

### Running the dashboard (`mockifyer-dashboard`)

- Backend: `npm run dev` in `/workspace/packages/mockifyer-dashboard` (Express on port 3002).
- Frontend: `npm run dev:frontend` in `/workspace/packages/mockifyer-dashboard`.

### Lint

- Dashboard frontend: `npm run lint` in `/workspace/packages/mockifyer-dashboard/frontend` (ESLint).
- Web frontend: no ESLint config committed — `lint` script exists in `package.json` but `.eslintrc` is missing.

### Gotchas

- `mockifyer-web` has a `postinstall` hook that runs `npm run build` (builds frontend + backend). This means `npm install` in that directory takes a while and also builds the project. For dev work, this is usually fine.
- `mockifyer-web` needs `nodemon`, `ts-node`, and `tsconfig-paths` as devDependencies for `npm run dev`. If they're missing, install them: `npm install --save-dev nodemon ts-node tsconfig-paths`.
- Redis is optional (only for `--provider redis`). Standard dev uses filesystem mocks in `mock-data/`.
- The root `package.json` is private — never publish from root.
