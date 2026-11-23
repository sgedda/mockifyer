import { inferFields, normalizeOverridePath } from './infer';
import { createMulberry32 } from './prng';
import {
  FieldKind,
  type FieldDescriptor,
  type FieldKindOverrides,
  type GenerateOptions,
  type InferResult,
} from './types';
import { generateValueForKind } from './values';

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
  // Fallbacks for override-normalized paths
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
function varyArrayLength(sampleLen: number, rng: ReturnType<typeof createMulberry32>): number {
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

function synthesizeValue(
  sample: unknown,
  path: string,
  key: string,
  map: Map<string, FieldDescriptor>,
  rng: ReturnType<typeof createMulberry32>
): unknown {
  if (sample === null) {
    const d = findDescriptor(map, path);
    if (d && d.kind !== FieldKind.Null && d.kind !== FieldKind.Unknown) {
      return generateValueForKind(d.kind, rng, d.samples, d.enumValues);
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
      out.push(synthesizeValue(itemTemplate, joinPath(path, i, true), key, map, rng));
    }
    return out;
  }

  if (typeof sample === 'object') {
    const obj = sample as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [childKey, childVal] of Object.entries(obj)) {
      out[childKey] = synthesizeValue(
        childVal,
        joinPath(path, childKey),
        childKey,
        map,
        rng
      );
    }
    return out;
  }

  const d = findDescriptor(map, path);
  if (d) {
    return generateValueForKind(d.kind, rng, d.samples, d.enumValues);
  }

  // No descriptor — preserve type with a light mutation
  if (typeof sample === 'string') {
    return generateValueForKind(FieldKind.FreeText, rng, [sample]);
  }
  if (typeof sample === 'number') {
    return generateValueForKind(
      Number.isInteger(sample) ? FieldKind.Integer : FieldKind.Number,
      rng,
      [sample]
    );
  }
  if (typeof sample === 'boolean') {
    return rng.next() < 0.5;
  }
  return sample;
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
 * Deterministic: identical `sample` + `seed` + options produce byte-identical
 * JSON across Node and browsers. Browser-safe (no `fs` / `path` / Node crypto).
 *
 * @example
 * ```ts
 * import { generate, FieldKind } from '@sgedda/mockifyer-core/generator';
 *
 * const records = generate(
 *   { id: 1, email: 'a@b.com', status: 'shipped' },
 *   { count: 5, seed: 42, overrides: { '$.status': FieldKind.Enum } }
 * );
 * ```
 *
 * @remarks
 * Extension hooks for SGE-71 (`context`, `locale`, `currency`) and SGE-72
 * (`chaosLevel`, `variants`, `markGenerated`, `scrubSecrets`) are accepted on
 * {@link GenerateOptions} but not applied yet.
 */
export function generate(sample: unknown, options: GenerateOptions = {}): unknown[] {
  const count = options.count ?? 1;
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`generate(): count must be a non-negative integer, got ${count}`);
  }
  if (count === 0) {
    return [];
  }

  const seed = options.seed ?? 0;
  const inferred = inferFields(sample, options.overrides);
  const map = descriptorMap(inferred.fields);
  const rootRng = createMulberry32(seed);

  const records: unknown[] = [];

  if (inferred.rootIsArray && Array.isArray(sample)) {
    // Sample is already a list of records — each generated item is one record
    // shaped like a typical element (merge templates by cycling).
    const templates = sample.length > 0 ? sample : [{}];
    for (let i = 0; i < count; i++) {
      // Derive a per-record stream so adding more count does not reshuffle earlier rows
      const recordSeed = `${hashPair(seed, i)}`;
      const rng = createMulberry32(recordSeed);
      const template = templates[i % templates.length];
      records.push(synthesizeValue(template, '$[*]', '', map, rng));
      // Touch rootRng so unused-seed paths stay reserved for future options
      void rootRng.next();
    }
    return records;
  }

  for (let i = 0; i < count; i++) {
    const recordSeed = `${hashPair(seed, i)}`;
    const rng = createMulberry32(recordSeed);
    records.push(synthesizeValue(sample, '$', '', map, rng));
    void rootRng.next();
  }

  return records;
}

/** Mix seed + index into a stable string seed (browser-safe). */
function hashPair(seed: number | string, index: number): string {
  return `${typeof seed === 'string' ? seed : seed >>> 0}:${index}`;
}
