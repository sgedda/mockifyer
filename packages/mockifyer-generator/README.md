# @sgedda/mockifyer-generator

Browser-safe, seeded mock-data generator for Mockifyer ([SGE-70](https://linear.app/sgedda/issue/SGE-70/generator-engine-field-kind-inference-seeded-offline-generation) / [SGE-71](https://linear.app/sgedda/issue/SGE-71/generator-context-guided-datasets-and-related-field-consistency)).

Infers field kinds from a JSON sample, then generates N records with the same shape. Uses Mulberry32 for structure (array lengths, enum picks) and seeded `@faker-js/faker` locale entry points for values. Same sample + seed + context ⇒ identical JSON in Node and browsers. No Node-only APIs and no network.

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
  // explicit options override parsed context:
  // locale: 'sv', currency: 'SEK', count: 5,
});
```

`parseContext(text)` exposes the offline parser for tests and tooling.

### Locales (lazy)

| Locale | Sync without preload? | How to load |
|--------|----------------------|-------------|
| `en` | Yes (statically bundled) | — |
| `sv`, `de`, `fr`, `es` | Only after `loadLocale` | `await loadLocale('sv')` or `generateAsync(...)` |

Sync `generate` / `createSeededFaker` **throw** if a non-`en` locale is requested but not yet loaded (no silent fallback).

Bundlers that support async `import()` can code-split `@faker-js/faker/locale/{sv,de,fr,es}` out of the main entry.

## Consistency (SGE-71)

After generation, related fields are aligned within each record:

- `total` / `subtotal` / `amount` = sum of line items (`qty * price` when present)
- ids carried through nested objects (`id` → `items[*].orderId`, `user.id` → `userId`)
- `created` / `createdAt` ≤ `updated` / `updatedAt` (and `start` ≤ `end`)
- currency fields match the resolved currency option

## Extension points

`GenerateOptions` still reserves (not yet applied):

- **SGE-72:** `chaosLevel`, `variants`, `markGenerated`, `scrubSecrets`

## Publish

Tag with `generator-v<version>` (see `.github/workflows/npm-publish.yml`), e.g. `generator-v0.1.0`.
