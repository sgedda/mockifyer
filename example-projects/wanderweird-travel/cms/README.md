# Wanderweird Umbraco CMS

Umbraco **18** hosts the mobile menu tree and content texts/images. The Expo app never talks to Umbraco directly — `cms-api` maps Delivery API → a stable nav JSON contract (with seed fallback).

## Run

```bash
# from example-projects/wanderweird-travel
npm run cms:run          # http://127.0.0.1:4400
# or
npm run cms:up           # Docker Compose service `umbraco`
```

Backoffice: http://127.0.0.1:4400/umbraco  
Login: `admin@wanderweird.mock` / `Wanderweird123!`

HTTP is allowed in Development (`UseHttps: false` + OpenIddict `DisableTransportSecurityRequirement`). Production must stay on HTTPS.

Delivery API (public):  
`GET /umbraco/delivery/api/v2/content?filter=contentType:mobileApp`

## Document types (seeded on first boot)

| Alias | Role |
|-------|------|
| `mobileApp` | App root (title + tagline). Allowed at root. |
| `tabScreen` | **Bottom tab** — `screenKey`, icon glyph, hero text/image, sort order |
| `contentPage` | Stacked screen — text/image **plus** True/false, Numeric, Date Picker, Tags, Color Picker, Multiple Textstring, Richtext, Content Picker |

On each boot the seeder adds any missing properties and fills demo values (featured flags, tags, chaos hint, highlights).

### App config (Umbraco → Expo)

**Global** on `mobileApp`: `showLuggageLottery`, `enableChaosDice`, `enableGraphqlTrips`, `minChaosForLegendary`, `defaultDiscoverKey`, `themePreset`, `maintenanceBanner`, `featureFlags` (tags), `appConfigJson`, `configVersion`.

**Per page** on `contentPage`: `layoutMode` (story / dossier / checklist), `showChaosMeter`, `showShareSheet`, `primaryAction` (back / deepLink / external), `deepLinkPath`, `externalUrl`, `pageConfigJson` (modules, analyticsKey, checklistSeed, CTA overrides).

Edit these in the backoffice on **Wanderweird App** or any content page; `cms-api` maps them onto `app.config` / `page.pageConfig`. Seed fallback: `services/cms-api/seed/navigation.json`.

`lore-api` then remixed that payload with live weather + the wanderer’s first trip before the app sees it.

`graphql-api` (:4206) further maps those REST shapes into GraphQL (chaosBand, packingProgress, `travelerDashboard`) and is reachable via `POST /graphql` on the gateway.

Allowed children (recursive stacks):

```
mobileApp → tabScreen → contentPage → contentPage → … (n levels)
```

`cms-api` walks Umbraco Delivery API **recursively** (`mapContentPage` → children of children) so Expo can deep-link any depth:

`/(tabs)/trips/content/trip-tips/border-agent-etiquette/prophecy-queue-numbers`

Each page response includes `breadcrumbs`, `stackDepth`, and `descendantCount`. Nested “Go deeper” links use `parentPath` so stacks stay correct.

On boot the seeder **idempotently** adds missing nested pages (works on fresh + existing SQLite DBs).

## Menu → Expo Router

| CMS node | App route |
|----------|-----------|
| `tabScreen` with `screenKey=trips` | `/(tabs)/trips` (stack root) |
| Child `contentPage` slug `trip-tips` | `/(tabs)/trips/content/trip-tips` |
| Nested page under that | `/(tabs)/trips/content/trip-tips/border-agent-etiquette` |
| Third level | `…/border-agent-etiquette/prophecy-queue-numbers` |

Same pattern for `discover`, `passport`, `account`. App-level toggles (`enableChaosDice`, `showLuggageLottery`, `minChaosForLegendary`, …) are read once via navigation and applied in Discover / trip detail.

Functional screens (`trips/[id]`, `trips/new`, APIs, account form) live in the same stacks beside CMS pages.

## Editing content

1. Open backoffice Content → **Wanderweird App**
2. Edit tab heroes / icons, or add nested Content Pages for deeper stack links
3. Publish — `cms-api` reads Delivery API on each request (no rebuild)

If Umbraco is down, `services/cms-api/seed/navigation.json` is used automatically (`source: "seed"`).
