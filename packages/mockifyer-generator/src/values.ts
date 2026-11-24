import type { Faker } from '@faker-js/faker';
import type { EnumMix } from './context';
import type { Prng } from './types';
import { FieldKind } from './types';

/**
 * Pick from `values` with optional relative weights (deterministic via {@link Prng}).
 */
export function weightedPick(
  rng: Prng,
  values: readonly string[],
  weights?: readonly number[]
): string {
  if (values.length === 0) {
    throw new Error('weightedPick requires a non-empty values array');
  }
  if (!weights || weights.length !== values.length) {
    return rng.pick(values);
  }
  const total = weights.reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? b : 0), 0);
  if (total <= 0) {
    return rng.pick(values);
  }
  let r = rng.next() * total;
  for (let i = 0; i < values.length; i++) {
    const w = weights[i]!;
    if (!(Number.isFinite(w) && w > 0)) continue;
    r -= w;
    if (r < 0) {
      return values[i]!;
    }
  }
  return values[values.length - 1]!;
}

/** Optional generation hints passed into value synthesis. */
export interface ValueHints {
  currency?: string;
  enumMix?: EnumMix;
  /** Field key (last path segment) — used for status-like enum targeting. */
  fieldKey?: string;
}

const STATUS_LIKE_KEY =
  /^(status|state|type|kind|role|level|tier|phase|mode|category)$/i;

/** Fixed ref date so faker.date.* is seed-deterministic (no wall clock). */
const FAKER_REF_DATE = '2024-06-15T12:00:00.000Z';

function isStatusLikeKey(key: string | undefined): boolean {
  if (!key) return false;
  return STATUS_LIKE_KEY.test(key.replace(/[^a-zA-Z0-9]/g, ''));
}

function moneyBounds(samples: unknown[]): { min: number; max: number; decimals: number } {
  const nums = samples.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) {
    return { min: 1, max: 500, decimals: 2 };
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const decimals = nums.every((n) => Number.isInteger(n)) ? 0 : 2;
  const span = max - min;
  return {
    min: Math.max(0, min - span * 0.25),
    max: max + (span || Math.abs(max) || 10) * 0.5,
    decimals,
  };
}

function intIdBounds(samples: unknown[]): { min: number; max: number } {
  const nums = samples.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) {
    return { min: 1, max: 100000 };
  }
  const maxAbs = Math.max(...nums.map((n) => Math.abs(Math.trunc(n))));
  const floor = Math.max(1, Math.floor(maxAbs / 10));
  return { min: floor, max: Math.max(floor + 1, maxAbs * 2) };
}

function numberBounds(
  samples: unknown[],
  integer: boolean
): { min: number; max: number; precision?: number } {
  const nums = samples.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) {
    return integer ? { min: 0, max: 1000 } : { min: 0, max: 1000, precision: 0.001 };
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || Math.abs(max) || 1;
  return integer
    ? { min: Math.floor(min - span * 0.1), max: Math.ceil(max + span * 0.1) }
    : { min: min - span * 0.1, max: max + span * 0.1, precision: 0.001 };
}

function freeTextLength(samples: unknown[]): number {
  const strings = samples.filter((v): v is string => typeof v === 'string');
  if (strings.length === 0) return 24;
  return Math.max(
    4,
    Math.round(strings.reduce((a, s) => a + s.length, 0) / strings.length)
  );
}

/**
 * Produce a value for the given field kind.
 *
 * Structure picks (enums) use {@link Prng}; realistic strings/numbers come from
 * a seeded {@link Faker} instance.
 */
export function generateValueForKind(
  kind: FieldKind,
  rng: Prng,
  faker: Faker,
  samples: unknown[],
  enumValues?: string[],
  hints?: ValueHints
): unknown {
  switch (kind) {
    case FieldKind.Email:
      return faker.internet.email();
    case FieldKind.FirstName:
      return faker.person.firstName();
    case FieldKind.LastName:
      return faker.person.lastName();
    case FieldKind.FullName:
      return faker.person.fullName();
    case FieldKind.ProductName:
      return faker.commerce.productName();
    case FieldKind.Uuid:
      return faker.string.uuid();
    case FieldKind.IntegerId: {
      const { min, max } = intIdBounds(samples);
      return faker.number.int({ min, max });
    }
    case FieldKind.Money: {
      const { min, max, decimals } = moneyBounds(samples);
      const amount = faker.number.float({ min, max, fractionDigits: decimals });
      return decimals === 0 ? Math.round(amount) : amount;
    }
    case FieldKind.Currency:
      if (hints?.currency) {
        return hints.currency;
      }
      return enumValues && enumValues.length > 0
        ? rng.pick(enumValues)
        : faker.finance.currencyCode();
    case FieldKind.Date:
      return faker.date
        .past({ years: 8, refDate: FAKER_REF_DATE })
        .toISOString()
        .slice(0, 10);
    case FieldKind.IsoTimestamp:
      return faker.date
        .recent({ days: 365 * 4, refDate: FAKER_REF_DATE })
        .toISOString();
    case FieldKind.Enum: {
      const mix = hints?.enumMix;
      if (mix && mix.values.length > 0 && isStatusLikeKey(hints?.fieldKey)) {
        return weightedPick(rng, mix.values, mix.weights);
      }
      if (enumValues && enumValues.length > 0) {
        return rng.pick(enumValues);
      }
      const fromSamples = [
        ...new Set(samples.filter((v): v is string => typeof v === 'string')),
      ];
      if (fromSamples.length > 0) {
        return rng.pick(fromSamples);
      }
      return rng.pick(['active', 'pending', 'closed'] as const);
    }
    case FieldKind.Url:
      return faker.internet.url();
    case FieldKind.Phone:
      return faker.phone.number();
    case FieldKind.Street:
      return faker.location.streetAddress();
    case FieldKind.City:
      return faker.location.city();
    case FieldKind.Zip:
      return faker.location.zipCode();
    case FieldKind.Country:
      return enumValues && enumValues.length > 0
        ? rng.pick(enumValues)
        : faker.location.countryCode();
    case FieldKind.Boolean:
      return rng.next() < 0.5;
    case FieldKind.FreeText: {
      const target = freeTextLength(samples);
      // lorem words ≈ 5 chars + space; request enough words then trim
      const words = Math.max(2, Math.ceil(target / 6));
      return faker.lorem.words(words);
    }
    case FieldKind.Number: {
      const { min, max, precision } = numberBounds(samples, false);
      return faker.number.float({
        min,
        max,
        fractionDigits: precision ? 3 : 2,
      });
    }
    case FieldKind.Integer: {
      const { min, max } = numberBounds(samples, true);
      return faker.number.int({ min, max });
    }
    case FieldKind.Null:
      return null;
    case FieldKind.Unknown:
    default: {
      const sample = samples.find((v) => v !== null && v !== undefined);
      if (typeof sample === 'string') {
        return generateValueForKind(FieldKind.FreeText, rng, faker, samples, enumValues, hints);
      }
      if (typeof sample === 'number') {
        return generateValueForKind(
          Number.isInteger(sample) ? FieldKind.Integer : FieldKind.Number,
          rng,
          faker,
          samples,
          enumValues,
          hints
        );
      }
      if (typeof sample === 'boolean') {
        return rng.next() < 0.5;
      }
      return sample ?? null;
    }
  }
}
