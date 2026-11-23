# @sgedda/mockifyer-generator

Browser-safe, seeded mock-data generator for Mockifyer ([SGE-70](https://linear.app/sgedda/issue/SGE-70/generator-engine-field-kind-inference-seeded-offline-generation)).

Infers field kinds from a JSON sample, then generates N records with the same shape. Uses Mulberry32 for structure (array lengths, enum picks) and a seeded `@faker-js/faker` instance (single `en` locale) for values. Same sample + seed ⇒ identical JSON in Node and browsers. No Node-only APIs and no network.

## Install

```bash
npm install @sgedda/mockifyer-generator
```

## Usage

```ts
import { generate, infer, FieldKind } from '@sgedda/mockifyer-generator';

const sample = {
  id: 1,
  email: 'a@b.com',
  status: 'shipped',
  orders: [{ total: 19.99 }],
};

const { fields } = infer(sample);

const records = generate(sample, {
  count: 5,
  seed: 42,
  overrides: { '$.status': FieldKind.Enum },
});
```

## Extension points

`GenerateOptions` reserves (not yet applied):

- **SGE-71:** `context`, `locale`, `currency`
- **SGE-72:** `chaosLevel`, `variants`, `markGenerated`, `scrubSecrets`

## Publish

Tag with `generator-v<version>` (see `.github/workflows/npm-publish.yml`), e.g. `generator-v0.1.0`.
