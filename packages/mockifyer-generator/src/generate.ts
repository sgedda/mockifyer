import { applyRelatedFieldConsistency } from './consistency';
import {
  LOCALE_DEFAULT_CURRENCY,
  parseContext,
  resolveLocaleCode,
  type EnumMix,
  type ParsedContext,
  type SupportedLocale,
} from './context';
import { createSeededFaker, loadLocale } from './faker';
import { inferFields, normalizeOverridePath } from './infer';
import { createMulberry32 } from './prng';
import {
  FieldKind,
  type FieldDescriptor,
  type FieldKindOverrides,
  type GenerateOptions,
  type InferResult,
  type Prng,
} from './types';
import { generateValueForKind, type ValueHints } from './values';
import type { Faker } from '@faker-js/faker';

function descriptorMap(fields: FieldDescriptor[]): Map<string, FieldDescriptor> {
  const map = new Map<string, FieldDescriptor>();
  for (const f of fields) {
    map.set(f.path, f);
  }
  return map;
}

function findDescriptor(
  map: Map<string, FieldDescriptor>,
  path: string
): FieldDescriptor | undefined {
  const direct = map.get(path);
  if (direct) return direct;
  for (const [p, d] of map) {
    if (
      normalizeOverridePath(p).replace(/\[\*\]/g, '') ===
      normalizeOverridePath(path).replace(/\[\*\]/g, '')
    ) {
      return d;
    }
  }
  return undefined;
}

/**
 * Plausible array length around the sample length (±50%).
 * Never returns 0 when the sample had items — empty arrays are reserved for
 * edge-case variants (`emptyLists`), not normal generation.
 */
function varyArrayLength(sampleLen: number, rng: Prng): number {
  if (sampleLen <= 0) {
    // Empty sample template: still emit at least one element in normal generate.
    return rng.int(1, 2);
  }
  const delta = Math.max(1, Math.ceil(sampleLen * 0.5));
  const min = Math.max(1, sampleLen - delta);
  const max = sampleLen + delta;
  return rng.int(min, max);
}

/**
 * Keys treated as list arrays when applying {@link GenerateOptions.itemCount}
 * (“Items per list” / context `"N items"`). Includes line items and common
 * entity collections (users, bookings, comments, …).
 */
const LINE_ITEM_ARRAY_KEYS = new Set([
  'items',
  'lineitems',
  'lines',
  'products',
  'entries',
  'details',
  'orderitems',
  'orderlineitems',
  'skus',
  'goods',
  'users',
  'customers',
  'people',
  'bookings',
  'transactions',
  'posts',
  'comments',
]);

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function isLineItemArrayKey(key: string): boolean {
  return LINE_ITEM_ARRAY_KEYS.has(normalizeKey(key));
}

function joinPath(parent: string, key: string | number, arrayItem = false): string {
  if (arrayItem) {
    return `${parent}[*]`;
  }
  if (parent === '$') {
    return `$.${key}`;
  }
  return `${parent}.${key}`;
}

interface SynthEnv {
  map: Map<string, FieldDescriptor>;
  rng: Prng;
  faker: Faker;
  hints: ValueHints;
  /** Exact length for nested line-item arrays when set. */
  itemCount?: number;
}

function synthesizeValue(
  sample: unknown,
  path: string,
  key: string,
  env: SynthEnv
): unknown {
  const { map, rng, faker, hints } = env;
  const fieldHints: ValueHints = { ...hints, fieldKey: key };

  if (sample === null) {
    const d = findDescriptor(map, path);
    if (d && d.kind !== FieldKind.Null && d.kind !== FieldKind.Unknown) {
      return generateValueForKind(d.kind, rng, faker, d.samples, d.enumValues, fieldHints);
    }
    return null;
  }

  if (Array.isArray(sample)) {
    const len =
      env.itemCount !== undefined && isLineItemArrayKey(key)
        ? env.itemCount
        : varyArrayLength(sample.length, rng);
    if (len === 0) {
      return [];
    }
    const template = sample.length > 0 ? sample : [null];
    const out: unknown[] = [];
    for (let i = 0; i < len; i++) {
      const itemTemplate = template[i % template.length];
      out.push(synthesizeValue(itemTemplate, joinPath(path, i, true), key, env));
    }
    return out;
  }

  if (typeof sample === 'object') {
    const obj = sample as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [childKey, childVal] of Object.entries(obj)) {
      out[childKey] = synthesizeValue(childVal, joinPath(path, childKey), childKey, env);
    }
    return out;
  }

  const d = findDescriptor(map, path);
  if (d) {
    return generateValueForKind(d.kind, rng, faker, d.samples, d.enumValues, fieldHints);
  }

  if (typeof sample === 'string') {
    return generateValueForKind(FieldKind.FreeText, rng, faker, [sample], undefined, fieldHints);
  }
  if (typeof sample === 'number') {
    return generateValueForKind(
      Number.isInteger(sample) ? FieldKind.Integer : FieldKind.Number,
      rng,
      faker,
      [sample],
      undefined,
      fieldHints
    );
  }
  if (typeof sample === 'boolean') {
    return rng.next() < 0.5;
  }
  return sample;
}

/**
 * Merge free-text context with explicit options. Explicit fields win.
 */
export function resolveGenerateSettings(options: GenerateOptions): {
  count: number;
  itemCount?: number;
  seed: number | string;
  locale: string;
  currency?: string;
  enumMix?: EnumMix;
  phoneFormat?: ParsedContext['phoneFormat'];
  overrides?: FieldKindOverrides;
  parsed: ParsedContext;
} {
  const parsed = options.context ? parseContext(options.context) : {};
  const locale = resolveLocaleCode(options.locale ?? parsed.locale);
  const currency =
    options.currency ??
    parsed.currency ??
    LOCALE_DEFAULT_CURRENCY[locale as SupportedLocale];
  const count = options.count ?? parsed.count ?? 1;
  const itemCount = options.itemCount ?? parsed.itemCount;
  return {
    count,
    itemCount,
    seed: options.seed ?? 0,
    locale,
    currency,
    enumMix: parsed.enumMix,
    phoneFormat: parsed.phoneFormat,
    overrides: options.overrides,
    parsed,
  };
}

/**
 * Infer field kinds from a JSON sample (optionally with path overrides).
 *
 * @example
 * ```ts
 * const { fields } = infer(sample, { '$.user.email': FieldKind.Email });
 * ```
 */
export function infer(sample: unknown, overrides?: FieldKindOverrides): InferResult {
  return inferFields(sample, overrides);
}

/**
 * Generate `count` synthetic records with the same shape as `sample`.
 *
 * Deterministic: identical `sample` + `seed` + options (including `context`)
 * produce byte-identical JSON across Node and browsers. Browser-safe (no
 * `fs` / `path` / Node crypto). Fully offline — no network or AI.
 *
 * Locale: sync `generate` supports `en` always, and any locale already loaded
 * via {@link loadLocale}. For other locales use {@link generateAsync} (or
 * `await loadLocale(...)` first). Unloaded non-`en` locales throw.
 *
 * Structure (array lengths, enum picks, shuffles) uses Mulberry32.
 * Field values use a seeded `@faker-js/faker` locale singleton.
 * Related-field consistency (totals, ids, dates, currency) runs after synthesis.
 *
 * @example
 * ```ts
 * import { generate, generateAsync } from '@sgedda/mockifyer-generator';
 *
 * generate(sample, { seed: 42 }); // en
 * await generateAsync(sample, {
 *   seed: 42,
 *   context: 'Swedish users, prices in SEK, 5 orders, mix of paid/refunded/failed',
 * });
 * ```
 */
const DEFAULT_LINE_ITEM = { id: 10, name: 'Widget', qty: 1, price: 9.99 };

function hasLineItemArray(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isLineItemArrayKey(key) && Array.isArray(child)) {
      return true;
    }
  }
  return false;
}

/**
 * When context asks for `N items` but the sample has no list array at all,
 * attach a small `items` template so {@link itemCount} can apply.
 * Samples that already have any array (e.g. `{ users: […] }`) are left alone —
 * itemCount targets those lists via {@link LINE_ITEM_ARRAY_KEYS}.
 */
function ensureLineItemTemplate(sample: unknown, itemCount?: number): unknown {
  if (itemCount === undefined) {
    return sample;
  }
  if (sample === null || typeof sample !== 'object' || Array.isArray(sample)) {
    return sample;
  }
  if (hasLineItemArray(sample)) {
    return sample;
  }
  const hasAnyArray = Object.values(sample as Record<string, unknown>).some((v) =>
    Array.isArray(v)
  );
  if (hasAnyArray) {
    return sample;
  }
  return { ...(sample as Record<string, unknown>), items: [DEFAULT_LINE_ITEM] };
}

export function generate(sample: unknown, options: GenerateOptions = {}): unknown[] {
  const settings = resolveGenerateSettings(options);
  const {
    count,
    itemCount,
    seed,
    locale,
    currency,
    enumMix,
    phoneFormat,
    overrides,
  } = settings;

  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`generate(): count must be a non-negative integer, got ${count}`);
  }
  if (itemCount !== undefined && (!Number.isInteger(itemCount) || itemCount < 0)) {
    throw new Error(
      `generate(): itemCount must be a non-negative integer, got ${itemCount}`
    );
  }
  if (count === 0) {
    return [];
  }

  const shapedSample = ensureLineItemTemplate(sample, itemCount);

  // Fail fast before synthesizing if locale is missing (createSeededFaker would throw too).
  createSeededFaker(seed, locale);

  const inferred = inferFields(shapedSample, overrides);
  const map = descriptorMap(inferred.fields);
  const rootRng = createMulberry32(seed);
  const hints: ValueHints = { currency, enumMix, locale, phoneFormat };
  const synthBase: Pick<SynthEnv, 'map' | 'hints' | 'itemCount'> = {
    map,
    hints,
    itemCount,
  };

  const records: unknown[] = [];

  if (inferred.rootIsArray && Array.isArray(shapedSample)) {
    const templates = shapedSample.length > 0 ? shapedSample : [{}];
    for (let i = 0; i < count; i++) {
      const recordSeed = hashPair(seed, i);
      const rng = createMulberry32(recordSeed);
      const faker = createSeededFaker(recordSeed, locale);
      const template = templates[i % templates.length];
      const raw = synthesizeValue(template, '$[*]', '', {
        ...synthBase,
        rng,
        faker,
      });
      records.push(applyRelatedFieldConsistency(raw, { currency }));
      void rootRng.next();
    }
    return records;
  }

  for (let i = 0; i < count; i++) {
    const recordSeed = hashPair(seed, i);
    const rng = createMulberry32(recordSeed);
    const faker = createSeededFaker(recordSeed, locale);
    const raw = synthesizeValue(shapedSample, '$', '', {
      ...synthBase,
      rng,
      faker,
    });
    records.push(applyRelatedFieldConsistency(raw, { currency }));
    void rootRng.next();
  }

  return records;
}

/**
 * Like {@link generate}, but loads the resolved locale first (dynamic import
 * for non-`en`). Prefer this when `context` / `locale` may request sv/de/fr/es.
 */
export async function generateAsync(
  sample: unknown,
  options: GenerateOptions = {}
): Promise<unknown[]> {
  const settings = resolveGenerateSettings(options);
  await loadLocale(settings.locale);
  return generate(sample, options);
}

/** Mix seed + index into a stable string seed (browser-safe). */
function hashPair(seed: number | string, index: number): string {
  return `${typeof seed === 'string' ? seed : seed >>> 0}:${index}`;
}
