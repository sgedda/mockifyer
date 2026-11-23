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
 * Plausible array length around the sample length (±50%, at least 0).
 */
function varyArrayLength(sampleLen: number, rng: Prng): number {
  if (sampleLen <= 0) {
    return rng.int(0, 2);
  }
  const delta = Math.max(1, Math.ceil(sampleLen * 0.5));
  const min = Math.max(0, sampleLen - delta);
  const max = sampleLen + delta;
  return rng.int(min, max);
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
    const len = varyArrayLength(sample.length, rng);
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
  seed: number | string;
  locale: string;
  currency?: string;
  enumMix?: EnumMix;
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
  return {
    count,
    seed: options.seed ?? 0,
    locale,
    currency,
    enumMix: parsed.enumMix,
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
export function generate(sample: unknown, options: GenerateOptions = {}): unknown[] {
  const settings = resolveGenerateSettings(options);
  const { count, seed, locale, currency, enumMix, overrides } = settings;

  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`generate(): count must be a non-negative integer, got ${count}`);
  }
  if (count === 0) {
    return [];
  }

  // Fail fast before synthesizing if locale is missing (createSeededFaker would throw too).
  createSeededFaker(seed, locale);

  const inferred = inferFields(sample, overrides);
  const map = descriptorMap(inferred.fields);
  const rootRng = createMulberry32(seed);
  const hints: ValueHints = { currency, enumMix };

  const records: unknown[] = [];

  if (inferred.rootIsArray && Array.isArray(sample)) {
    const templates = sample.length > 0 ? sample : [{}];
    for (let i = 0; i < count; i++) {
      const recordSeed = hashPair(seed, i);
      const rng = createMulberry32(recordSeed);
      const faker = createSeededFaker(recordSeed, locale);
      const template = templates[i % templates.length];
      const raw = synthesizeValue(template, '$[*]', '', { map, rng, faker, hints });
      records.push(applyRelatedFieldConsistency(raw, { currency }));
      void rootRng.next();
    }
    return records;
  }

  for (let i = 0; i < count; i++) {
    const recordSeed = hashPair(seed, i);
    const rng = createMulberry32(recordSeed);
    const faker = createSeededFaker(recordSeed, locale);
    const raw = synthesizeValue(sample, '$', '', { map, rng, faker, hints });
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
