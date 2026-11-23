import {
  ALL_VARIANT_KINDS,
  VARIANT_KIND_SLUGS,
  selectVariantKinds,
  type ChaosLevel,
  type VariantKind,
} from './chaos';
import {
  deepClone,
  normalizeToMockData,
  type GeneratedMockData,
  type StoredResponseStream,
} from './mock-format';
import { createMulberry32 } from './prng';
import {
  collectSensitiveLiterals,
  findSecretLeaks,
  scrubValue,
} from './scrub';
import type { Prng } from './types';

/** Options for {@link variants}. */
export interface VariantsOptions {
  /** Seed for deterministic selection and content. */
  seed?: number | string;
  /**
   * Chaos intensity: `realistic` | `mild` | `wild` | `nightmare`, or `0..1`.
   * Higher ⇒ more / harsher variants. Default: `mild`.
   */
  chaosLevel?: ChaosLevel;
  /** Optional allowlist; intersected with kinds enabled by `chaosLevel`. */
  kinds?: VariantKind[];
  /** Scenario name prefix (default `generated`). */
  scenario?: string;
  /** Scrub secrets/PII from sample before mutating (default `true`). */
  scrubSecrets?: boolean;
}

/** One named edge-case mock ready to save as a scenario. */
export interface NamedVariant {
  kind: VariantKind;
  /** Scenario slug, e.g. `empty-lists`, `http-404`. */
  name: string;
  mock: GeneratedMockData;
}

const REQUIRED_KEY_RE =
  /^(id|ids|uuid|guid|status|type|kind|method|url|path|code|name|title|key)$/i;

const OPTIONAL_KEY_RE =
  /^(optional|description|note|notes|middle|suffix|prefix|meta|comment|hint|bio|about|nickname|alias)/i;

const LONG_STRING_LENGTH = 8_192;

const ERROR_BODIES: Record<400 | 401 | 404 | 500, { error: string; message: string }> = {
  400: { error: 'Bad Request', message: 'The request could not be understood.' },
  401: { error: 'Unauthorized', message: 'Authentication is required.' },
  404: { error: 'Not Found', message: 'The requested resource was not found.' },
  500: { error: 'Internal Server Error', message: 'An unexpected error occurred.' },
};

/**
 * Generate named edge-case variants from a recorded mock or bare JSON sample.
 *
 * Deterministic: same `sample` + `seed` + `chaosLevel` (+ `kinds`) ⇒ identical output.
 * Every mock is marked `generated: true`. Secrets/PII from the sample are scrubbed.
 *
 * @example
 * ```ts
 * import { variants } from '@sgedda/mockifyer-generator';
 *
 * const out = variants(recordedMock, { seed: 42, chaosLevel: 'wild' });
 * // → [{ kind: 'emptyLists', name: 'empty-lists', mock }, ...]
 * ```
 */
export function variants(sample: unknown, options: VariantsOptions = {}): NamedVariant[] {
  const seed = options.seed ?? 0;
  const scrub = options.scrubSecrets !== false;
  const baseScenario = options.scenario ?? 'generated';
  const seedKey = `${typeof seed === 'string' ? seed : seed >>> 0}`;

  const forbidden = collectSensitiveLiterals(sample);
  const base = normalizeToMockData(sample, { seedKey, scenario: baseScenario });
  const scrubbedBase = scrub
    ? (scrubValue(base, forbidden) as GeneratedMockData)
    : base;
  scrubbedBase.generated = true;

  let kinds = selectVariantKinds(options.chaosLevel, options.kinds);
  // truncatedStream only when the sample already has a stream timeline
  if (!scrubbedBase.response.stream) {
    kinds = kinds.filter((k) => k !== 'truncatedStream');
  }

  const results: NamedVariant[] = [];
  for (const kind of kinds) {
    const rng = createMulberry32(`${seedKey}:variant:${kind}`);
    const mock = applyVariant(
      scrubbedBase,
      kind,
      rng,
      `${baseScenario}-${VARIANT_KIND_SLUGS[kind]}`
    );
    mock.generated = true;

    if (scrub) {
      let cleaned = scrubValue(mock, forbidden) as GeneratedMockData;
      cleaned.generated = true;
      const leaks = findSecretLeaks(cleaned, forbidden);
      if (leaks.length > 0) {
        const reinforced = new Set(forbidden);
        for (const lit of leaks) reinforced.add(lit);
        cleaned = scrubValue(cleaned, reinforced) as GeneratedMockData;
        cleaned.generated = true;
      }
      results.push({ kind, name: VARIANT_KIND_SLUGS[kind], mock: cleaned });
    } else {
      results.push({ kind, name: VARIANT_KIND_SLUGS[kind], mock });
    }
  }

  return results;
}

function applyVariant(
  base: GeneratedMockData,
  kind: VariantKind,
  rng: Prng,
  scenario: string
): GeneratedMockData {
  const mock = deepClone(base);
  mock.scenario = scenario;
  mock.generated = true;
  mock.timestamp = base.timestamp;

  switch (kind) {
    case 'emptyLists':
      mock.response.data = emptyLists(mock.response.data);
      break;
    case 'missingOptional':
      mock.response.data = removeOptionalFields(mock.response.data, rng);
      break;
    case 'nulls':
      mock.response.data = nullifyFields(mock.response.data, rng);
      break;
    case 'longStrings':
      mock.response.data = lengthenStrings(mock.response.data, rng);
      break;
    case 'unicode':
      mock.response.data = injectUnicode(mock.response.data, rng);
      break;
    case 'http400':
      applyHttpError(mock, 400);
      break;
    case 'http401':
      applyHttpError(mock, 401);
      break;
    case 'http404':
      applyHttpError(mock, 404);
      break;
    case 'http500':
      applyHttpError(mock, 500);
      break;
    case 'slow':
      mock.responseDelayMs = 1_000 + rng.int(0, 29) * 1_000; // 1s–30s
      break;
    case 'truncatedStream':
      mock.response.stream = truncateStream(mock.response.stream, rng);
      if (mock.response.stream) {
        mock.response.data = mock.response.stream.chunks.map((c) => c.data).join('');
      }
      break;
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unknown variant kind: ${_exhaustive}`);
    }
  }

  return mock;
}

function applyHttpError(mock: GeneratedMockData, status: 400 | 401 | 404 | 500): void {
  mock.response.status = status;
  mock.statusOverride = status;
  mock.response.data = { ...ERROR_BODIES[status] };
  mock.response.headers = {
    ...mock.response.headers,
    'content-type': 'application/json',
  };
  delete mock.response.stream;
}

function emptyLists(value: unknown): unknown {
  if (Array.isArray(value)) {
    return [];
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = emptyLists(v);
    }
    return out;
  }
  return value;
}

function removeOptionalFields(value: unknown, rng: Prng): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => removeOptionalFields(item, rng));
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      if (v === null || OPTIONAL_KEY_RE.test(k)) {
        continue;
      }
      if (!REQUIRED_KEY_RE.test(k) && typeof v !== 'object' && rng.next() < 0.45) {
        continue;
      }
      out[k] = removeOptionalFields(v, rng);
    }
    if (Object.keys(out).length === 0 && entries.length > 0) {
      const [k, v] = entries[0]!;
      out[k] = removeOptionalFields(v, rng);
    }
    return out;
  }
  return value;
}

function nullifyFields(value: unknown, rng: Prng): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => nullifyFields(item, rng));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REQUIRED_KEY_RE.test(k)) {
        out[k] = nullifyFields(v, rng);
        continue;
      }
      if (v === null || rng.next() < 0.55) {
        out[k] = null;
      } else {
        out[k] = nullifyFields(v, rng);
      }
    }
    return out;
  }
  return value;
}

function lengthenStrings(value: unknown, rng: Prng): unknown {
  if (typeof value === 'string') {
    return buildLongString(rng);
  }
  if (Array.isArray(value)) {
    return value.map((item) => lengthenStrings(item, rng));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = lengthenStrings(v, rng);
    }
    return out;
  }
  return value;
}

/** Synthetic long string — never copies sample content (avoids secret leak). */
function buildLongString(rng: Prng): string {
  const alphabet =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_';
  const prefix = 'LONG:';
  let body = '';
  while (prefix.length + body.length < LONG_STRING_LENGTH) {
    body += alphabet[rng.int(0, alphabet.length - 1)]!;
  }
  return (prefix + body).slice(0, LONG_STRING_LENGTH);
}

function injectUnicode(value: unknown, rng: Prng): unknown {
  if (typeof value === 'string') {
    // Replace rather than wrap sample text so PII emails cannot survive via concatenation
    const glyphs = ['你好', 'مرحبا', '🎉', '🚀', 'Ω', 'ß', 'ñ', '東京', '✨', 'Ü'];
    const parts: string[] = [];
    const count = 4 + rng.int(0, 4);
    for (let i = 0; i < count; i++) {
      parts.push(rng.pick(glyphs));
    }
    return parts.join(' ');
  }
  if (Array.isArray(value)) {
    return value.map((item) => injectUnicode(item, rng));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = injectUnicode(v, rng);
    }
    return out;
  }
  return value;
}

function truncateStream(
  stream: StoredResponseStream | undefined,
  rng: Prng
): StoredResponseStream | undefined {
  if (!stream || stream.chunks.length === 0) {
    return stream ? { ...stream, chunks: [], truncated: true } : undefined;
  }
  const keep = Math.max(
    1,
    Math.min(stream.chunks.length, rng.int(1, Math.ceil(stream.chunks.length / 2)))
  );
  return {
    kind: stream.kind,
    chunks: stream.chunks.slice(0, keep).map((c) => ({ offsetMs: c.offsetMs, data: c.data })),
    ...(stream.firstChunkDelayMs !== undefined
      ? { firstChunkDelayMs: stream.firstChunkDelayMs }
      : {}),
    truncated: true,
  };
}

/** Exported for tests — full kind catalog. */
export { ALL_VARIANT_KINDS };
