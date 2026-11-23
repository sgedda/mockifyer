# @sgedda/mockifyer-generator

Browser-safe, seeded mock-data generator for Mockifyer ([SGE-70](https://linear.app/sgedda/issue/SGE-70) / [SGE-71](https://linear.app/sgedda/issue/SGE-71) / [SGE-72](https://linear.app/sgedda/issue/SGE-72)).

Infers field kinds from a JSON sample, then generates N records with the same shape. Uses Mulberry32 for structure (array lengths, enum picks) and seeded `@faker-js/faker` locale entry points for values. Same sample + seed + context ⇒ identical JSON in Node and browsers. No Node-only APIs and no network on the main entry.

## Install

```bash
npm install @sgedda/mockifyer-generator
```

## Usage

```ts
import {
  generate,
  generateAsync,
  loadLocale,
  parseContext,
  variants,
  FieldKind,
} from '@sgedda/mockifyer-generator';

const sample = {
  id: 1,
  email: 'a@b.com',
  status: 'shipped',
  currency: 'USD',
  total: 19.99,
  items: [{ orderId: 1, qty: 2, price: 9.99 }],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
};

// English (default) — sync
const enRecords = generate(sample, { count: 3, seed: 42 });

// Non-English: load locale first, or use generateAsync
await loadLocale('sv');
generate(sample, { seed: 42, locale: 'sv' });

const records = await generateAsync(sample, {
  seed: 42,
  context: 'Swedish users, prices in SEK, 5 orders, mix of paid/refunded/failed',
});
```

`parseContext(text)` exposes the offline parser for tests and tooling.

### Locales (lazy)

| Locale | Sync without preload? | How to load |
|--------|----------------------|-------------|
| `en` | Yes (statically bundled) | — |
| `sv`, `de`, `fr`, `es` | Only after `loadLocale` | `await loadLocale('sv')` or `generateAsync(...)` |

Sync `generate` / `createSeededFaker` **throw** if a non-`en` locale is requested but not yet loaded (no silent fallback).

## Consistency (SGE-71)

After generation, related fields are aligned within each record:

- `total` / `subtotal` / `amount` = sum of line items (`qty * price` when present)
- ids carried through nested objects (`id` → `items[*].orderId`, `user.id` → `userId`)
- `created` / `createdAt` ≤ `updated` / `updatedAt` (and `start` ≤ `end`)
- currency fields match the resolved currency option

## Edge-case variants (SGE-72)

```ts
import { variants, serializeMock, toScenarioMap } from '@sgedda/mockifyer-generator';

const named = variants(recordedMockOrJson, {
  seed: 42,
  chaosLevel: 'wild', // realistic | mild | wild | nightmare — or 0..1
  // kinds: ['emptyLists', 'http404'], // optional allowlist
});

// Each entry: { kind, name, mock } with mock.generated === true
for (const v of named) {
  console.log(v.name, v.mock.response.status, serializeMock(v.mock));
}

const scenarios = toScenarioMap(named); // { 'generated-empty-lists': mock, ... }
```

### Chaos level

| Level | Approx. intensity | Typical kinds |
|-------|-------------------|---------------|
| `realistic` | 0.1 | empty lists |
| `mild` (default) | 0.35 | + missing optional, nulls |
| `wild` | 0.7 | + long strings, unicode, 400/404, slow |
| `nightmare` | 1.0 | + 401/500, truncated stream (when sample has `response.stream`) |

Same `seed` + `chaosLevel` ⇒ identical named set and mock bodies.

Identifier fields (`id`, `*Id`, `*_id`, `uuid`, `slug`, and inferred Uuid/IntegerId kinds) stay unchanged at `realistic` / `mild` / `wild`. They are only scrambled at `nightmare`, or when `scrambleIds: true` is set (use `scrambleIds: false` to keep ids even at nightmare).

### Secret scrub

Variants scrub Authorization / api keys / tokens / cookies (Atlas rules) and guarantee sample emails and other collected PII literals never appear in output.

### Node: write scenarios to disk

```ts
import { variants } from '@sgedda/mockifyer-generator';
import { writeVariantScenarios } from '@sgedda/mockifyer-generator/node';

const named = variants(sample, { seed: 7, chaosLevel: 'nightmare' });
writeVariantScenarios(named, { mockDataPath: './mock-data' });
// → mock-data/generated-empty-lists/{hostname}/{path…}/GET_{date}_{hash}.json
//    (same layout as core recordings — ready for MOCKIFYER_SCENARIO replay)
```

The main entry stays browser-safe; only `@sgedda/mockifyer-generator/node` uses `fs`.

## CLI (SGE-73)

Standalone binary — **no Mockifyer dashboard required**. Core does not depend on this package.

```bash
# after install / publish
npx -p @sgedda/mockifyer-generator mockifyer-generate --help

# from this repo (after npm run build in packages/mockifyer-generator)
node packages/mockifyer-generator/dist/cli/index.js --help
```

### `variants` — edge cases from a recorded mock

```bash
mockifyer-generate variants ./path/to/GET_….json \
  --level wild \
  --seed 42 \
  --out ./mock-data \
  --scenario-prefix trip

# preview only (stdout summary + JSON, no writes)
mockifyer-generate variants ./mock.json --dry-run --seed 42
```

| Flag | Meaning |
|------|---------|
| `--level` | `realistic` \| `mild` \| `wild` \| `nightmare` (or `0..1`) |
| `--kinds` | Comma list of kinds (camelCase or slug), e.g. `emptyLists,http-404` |
| `--seed` | Deterministic seed |
| `--out` | mock-data root (default `./mock-data`) |
| `--scenario-prefix` | Scenario name prefix (default `generated`) |
| `--dry-run` | Print summary + JSON; write nothing |
| `--scramble-ids` | Allow mutating id fields (default: only at nightmare) |

Requires a Mockifyer mock document (`request` + `response`). Bare JSON is rejected with a clear error.

### `sample` — generate records from sample / context

```bash
mockifyer-generate sample --context 'swedish users, 10 items' --seed 7
mockifyer-generate sample ./user.json --count 5 --locale sv --out users.json
```

| Flag | Meaning |
|------|---------|
| `--context` | Free-text context (locale / count / currency / enum mix) |
| `--count` | Record count (overrides context when set) |
| `--locale` | `en` \| `sv` \| `de` \| `fr` \| `es` (unknown → error) |
| `--seed` | Deterministic seed |
| `--out` | Write JSON file instead of stdout |

Exit codes: `0` success, `1` error (missing file, invalid mock/JSON, unknown locale/kind/level).

## Publish

Tag with `generator-v<version>` (see `.github/workflows/npm-publish.yml`), e.g. `generator-v0.1.0`.
