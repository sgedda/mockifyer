# Wanderweird

A playful Expo travel showcase for **Mockifyer** + **Umbraco CMS**: login, manage absurd trips, browse CMS-driven tab/stack navigation, discover open-API weather/FX mashed with fictional destinations, stamp a passport, and roll chaos dice.

```
apps/mobile          Expo SDK 57 — bottom tabs + stacked screens from CMS menu
cms/umbraco          Umbraco 18 + Delivery API (menu tree + content texts/images)
services/gateway-api BFF on :4200  (app talks only here; proxies /graphql)
services/auth-api    Fake auth + account settings :4201
services/trips-api   Trip CRUD, chaos dice, passport :4202
services/wander-api  Open-Meteo + Frankfurter + Advice Slip + Bored + countries + OpenTripMap :4203
services/cms-api     Umbraco Delivery API → nav contract (:4204, seed fallback)
services/lore-api    Remix hop (:4205) — mutates CMS copy using wander + trips
services/graphql-api GraphQL Yoga BFF (:4206) — maps + aggregates REST services
packages/mock-bootstrap  Shared filesystem / dashboard-proxy init
mock-data/           Shared Mockifyer scenario root
docker/              Node image for the Compose cluster
```

## Quick start

### 1. Install Node services

```bash
cd example-projects/wanderweird-travel
npm install
```

### 2. Start APIs (+ optional Umbraco)

```bash
# Local Node services (cms-api falls back to seed if Umbraco is down)
npm run dev

# Umbraco CMS (Delivery API on :4400)
npm run cms:run
# or Docker:
# npm run cms:up

# Full Docker cluster (Umbraco + all Node services on one network)
npm run cluster:up
# npm run cluster:logs
# npm run cluster:down

# optional dashboard:
npm run dashboard
```

GraphQL playground (local or cluster): [http://127.0.0.1:4206/graphql](http://127.0.0.1:4206/graphql)  
App / Mockifyer also hit it via the gateway: `POST http://127.0.0.1:4200/graphql`

Backoffice (after first boot): `http://127.0.0.1:4400/umbraco`  
User: `admin@wanderweird.mock` / `Wanderweird123!`

### 3. Start the Expo app

```bash
cd apps/mobile
npm run start:hybrid
```

**Demo logins**

| User | Password | Flavor |
|------|----------|--------|
| `wanderer` | `wanderer` | Spicy chaos default |
| `jetlag` | `jetlag` | Existential timezone survivor |

## CMS menu → app navigation

Umbraco content tree (seeded on first run):

```
mobileApp (Wanderweird App)
├── tabScreen Trips      → bottom tab + stack
│   ├── contentPage Trip Tips
│   │   └── contentPage Border Agent Etiquette   ← deeper stack
│   └── contentPage Packing Guide
├── tabScreen Discover   → bottom tab + stack
│   ├── contentPage Serendipity Explained
│   │   └── contentPage How Scoring Works
│   └── contentPage Luggage Lottery Rules
├── tabScreen Passport   → bottom tab + stack
│   └── contentPage Stamp Lore
│       └── contentPage Ink Recipes
└── tabScreen Account    → bottom tab + stack
    ├── contentPage About Wanderweird
    └── contentPage Privacy
```

- **Bottom tabs** = `tabScreen` children of `mobileApp` (title, icon glyph, hero text/image)
- **Stacked screens** = nested `contentPage` tree under each tab (`/(tabs)/{screenKey}/content/{...slug}`)
- Functional screens stay in each stack too (`trips/[id]`, `trips/new`, discover APIs, account form)

`cms-api` prefers live Umbraco Delivery API and falls back to `services/cms-api/seed/navigation.json` so the app always boots.

## Screens

- **Login** — gateway → auth-api
- **Trips stack** — CMS hero/links + list / create / trip dossier
- **Discover stack** — CMS pages + Open-Meteo / Frankfurter / Advice Slip / Bored (delay activity) / REST Countries-compatible / OpenTripMap + luggage lottery

### Extra open APIs on Discover

| Source | Used for |
|--------|----------|
| [Bored API](https://bored-api.appbrewery.com/) (App Brewery mirror) | “What to do when your flight is delayed” |
| [apicountries.com](https://www.apicountries.com/) | REST Countries-shaped flags, languages, population (official restcountries.com v3 is deprecated → v5 needs a key) |
| [OpenTripMap](https://opentripmap.io/) | Nearby POIs around each destination’s real-world cousin (`OPENTRIPMAP_API_KEY`, free signup) |
- **Passport stack** — CMS pages + stamps
- **Account stack** — CMS pages + profile settings
- **Dev menu** (`__DEV__` only) — Account → “Mockifyer dev menu”, or shake device → Dev Menu → “Mockifyer Dev Menu”. Toggle Mockifyer on/off and **record mode** (manual; off by default), pick/create scenarios, set scenario (global) or client-lane dates. Needs dashboard for create/date (`npm run dashboard`).

## Mockifyer wiring

| Layer | How |
|-------|-----|
| Node services | `@wanderweird/mock-bootstrap` → filesystem or dashboard proxy |
| Shared lane | `MOCKIFYER_CLIENT_ID=wanderweird-demo`, `MOCKIFYER_PATH=../../mock-data` |
| Expo app | `setupMockifyerForReactNative` / dashboard preset |
| CMS hop | app → gateway → **lore-api** → cms-api → Umbraco |
| Lore remix | lore-api also fetches wander-api + trips-api and rewrites titles, footnotes, vibeIndex |
| GraphQL | app → gateway `/graphql` → **graphql-api** → auth / trips / wander / lore (mapped fields + `travelerDashboard`) |

### Hop recording (client-id gate, request stubs only)

**Filesystem (no Redis/sqlite):** shared `MOCKIFYER_PATH` + services recording stubs:

```bash
npm run dashboard                 # filesystem is enough to browse /hops
npm run dev:record:stubs          # RECORD=true, RECORD_RESPONSES=false, client_id_header
# Expo: Mockifyer on + client id (Record bodies OFF optional on the app)
```

Nested outbound hops land under `mock-data/<scenario>/` with `parentRequestId` → `/hops` shows the tree.

**Proxy + sqlite** (same stub semantics, central store / Network tab):

```bash
npm run dashboard:sqlite
npm run dev:proxy:record
npm run lane:hello                # map wanderweird-demo → hello (strict lane)
npm run dev:mobile
```

| Knob | Value |
|------|--------|
| Activation | `MOCKIFYER_ACTIVATION_MODE=client_id_header` |
| Record | `MOCKIFYER_RECORD=true` |
| Bodies | `MOCKIFYER_RECORD_RESPONSES=false` — request-only stubs (`responsePending`) |

Open `http://127.0.0.1:3002/hops?scenario=hello` after a multi-service flow. Prefer `dashboard:redis` if you run `npm run redis:up`. If sqlite fails (`better-sqlite3` NODE_MODULE_VERSION): `npm --prefix packages/mockifyer-dashboard rebuild better-sqlite3`.

```
App fetch → gateway :4200
         → lore-api :4205 → cms-api :4204 → Umbraco :4400
                         → wander-api :4203 → open-meteo / frankfurter / adviceslip
                         → trips-api :4202
         → graphql-api :4206 → auth + trips + wander + lore
                               (chaosBand, packingProgress, travelerDashboard, …)
```

### Docker cluster

`npm run cluster:up` builds one Node image and starts every service on the `wanderweird` bridge network with Docker DNS names (`http://trips-api:4202`, etc.). Gateway stays on host port `4200`; Umbraco on `4400`. Redis is optional: `npm run redis:up` (Compose profile `redis`).

Android emulator: gateway defaults to `http://10.0.2.2:4200`. Override with `EXPO_PUBLIC_GATEWAY_URL`.

## Fun destinations (fictional)

Atlantis Boardwalk · Moon Base Brunch Bar · Narnia Customs Queue · Upside-Down Farmers Market · Bermuda Triangular Buffet · Cloud Nine B&B
