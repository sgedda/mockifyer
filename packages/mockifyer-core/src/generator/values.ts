import type { Prng } from './types';
import { FieldKind } from './types';

const FIRST_NAMES = [
  'Ava',
  'Noah',
  'Mia',
  'Liam',
  'Zoe',
  'Ethan',
  'Iris',
  'Owen',
  'Luna',
  'Leo',
  'Nora',
  'Kai',
  'Ella',
  'Milo',
  'Chloe',
] as const;

const LAST_NAMES = [
  'Andersson',
  'Berg',
  'Carter',
  'Diaz',
  'Eriksson',
  'Foster',
  'Garcia',
  'Hansen',
  'Ibrahim',
  'Johansson',
  'Kim',
  'Lindberg',
  'Nguyen',
  'Olsson',
  'Patel',
] as const;

const CITIES = [
  'Stockholm',
  'Berlin',
  'Lisbon',
  'Austin',
  'Tokyo',
  'Toronto',
  'Sydney',
  'Oslo',
  'Madrid',
  'Seoul',
] as const;

const STREETS = [
  'Oak Street',
  'Maple Avenue',
  'Cedar Lane',
  'Pine Road',
  'Birch Boulevard',
  'Willow Way',
  'Elm Court',
  'Spruce Drive',
] as const;

const COUNTRIES = [
  'SE',
  'US',
  'DE',
  'GB',
  'FR',
  'JP',
  'CA',
  'AU',
  'NO',
  'ES',
] as const;

const CURRENCIES = ['USD', 'EUR', 'SEK', 'GBP', 'JPY', 'CAD', 'AUD', 'NOK'] as const;

const FREE_WORDS = [
  'alpha',
  'bravo',
  'cascade',
  'delta',
  'echo',
  'falcon',
  'grove',
  'harbor',
  'ivory',
  'jade',
  'kite',
  'lunar',
  'marble',
  'nebula',
  'orchid',
] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function pad4(n: number): string {
  const s = String(n);
  return s.length >= 4 ? s.slice(0, 4) : `${'0000'.slice(s.length)}${s}`;
}

function hexByte(rng: Prng): string {
  return rng.int(0, 255).toString(16).padStart(2, '0');
}

/**
 * Generate a UUID v4-shaped string from the PRNG (not cryptographically random).
 */
export function generateUuid(rng: Prng): string {
  const bytes: string[] = [];
  for (let i = 0; i < 16; i++) {
    bytes.push(hexByte(rng));
  }
  // version 4
  bytes[6] = ((parseInt(bytes[6]!, 16) & 0x0f) | 0x40).toString(16).padStart(2, '0');
  // variant 10xx
  bytes[8] = ((parseInt(bytes[8]!, 16) & 0x3f) | 0x80).toString(16).padStart(2, '0');
  return (
    bytes.slice(0, 4).join('') +
    '-' +
    bytes.slice(4, 6).join('') +
    '-' +
    bytes.slice(6, 8).join('') +
    '-' +
    bytes.slice(8, 10).join('') +
    '-' +
    bytes.slice(10, 16).join('')
  );
}

function generateIsoDate(rng: Prng): string {
  const year = rng.int(2018, 2026);
  const month = rng.int(1, 12);
  const day = rng.int(1, 28);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function generateIsoTimestamp(rng: Prng): string {
  const date = generateIsoDate(rng);
  const h = rng.int(0, 23);
  const m = rng.int(0, 59);
  const s = rng.int(0, 59);
  return `${date}T${pad2(h)}:${pad2(m)}:${pad2(s)}.${pad4(rng.int(0, 999)).padStart(3, '0')}Z`;
}

function generateMoney(rng: Prng, samples: unknown[]): number {
  const nums = samples.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length > 0) {
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const span = max - min || Math.max(Math.abs(max) * 0.5, 10);
    const base = min + rng.next() * (span === 0 ? 10 : span * 1.5);
    // Preserve integer vs decimal style from samples
    if (nums.every((n) => Number.isInteger(n))) {
      return Math.round(base);
    }
    return Math.round(base * 100) / 100;
  }
  return Math.round(rng.next() * 50000) / 100;
}

function generateIntegerId(rng: Prng, samples: unknown[]): number {
  const nums = samples.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length > 0) {
    const max = Math.max(...nums.map((n) => Math.abs(Math.trunc(n))));
    const floor = Math.max(1, Math.floor(max / 10));
    return rng.int(floor, Math.max(floor + 1, max * 2));
  }
  return rng.int(1, 100000);
}

function generateNumber(rng: Prng, samples: unknown[], integer: boolean): number {
  const nums = samples.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length > 0) {
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const v = min + rng.next() * ((max - min) || Math.abs(max) || 1);
    return integer ? Math.round(v) : Math.round(v * 1000) / 1000;
  }
  return integer ? rng.int(0, 1000) : Math.round(rng.next() * 1000) / 1000;
}

function generateFreeText(rng: Prng, samples: unknown[]): string {
  const strings = samples.filter((v): v is string => typeof v === 'string');
  const targetLen =
    strings.length > 0
      ? Math.round(strings.reduce((a, s) => a + s.length, 0) / strings.length)
      : 24;
  const words: string[] = [];
  let len = 0;
  while (len < Math.max(4, targetLen)) {
    const w = rng.pick(FREE_WORDS);
    words.push(w);
    len += w.length + 1;
  }
  return words.join(' ');
}

function generateEmail(rng: Prng): string {
  const user = `${rng.pick(FIRST_NAMES).toLowerCase()}.${rng.pick(LAST_NAMES).toLowerCase()}${rng.int(1, 99)}`;
  const domain = rng.pick(['example.com', 'mail.test', 'demo.io'] as const);
  return `${user}@${domain}`;
}

function generatePhone(rng: Prng): string {
  return `+1${rng.int(200, 999)}${rng.int(200, 999)}${rng.int(1000, 9999)}`;
}

function generateUrl(rng: Prng): string {
  const host = rng.pick(['example.com', 'cdn.test', 'assets.demo'] as const);
  const slug = rng.pick(FREE_WORDS);
  return `https://${host}/${slug}/${rng.int(1, 9999)}`;
}

function generateZip(rng: Prng): string {
  return String(rng.int(10000, 99999));
}

/**
 * Produce a value for the given field kind using the seeded PRNG.
 */
export function generateValueForKind(
  kind: FieldKind,
  rng: Prng,
  samples: unknown[],
  enumValues?: string[]
): unknown {
  switch (kind) {
    case FieldKind.Email:
      return generateEmail(rng);
    case FieldKind.FirstName:
      return rng.pick(FIRST_NAMES);
    case FieldKind.LastName:
      return rng.pick(LAST_NAMES);
    case FieldKind.FullName:
      return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
    case FieldKind.Uuid:
      return generateUuid(rng);
    case FieldKind.IntegerId:
      return generateIntegerId(rng, samples);
    case FieldKind.Money:
      return generateMoney(rng, samples);
    case FieldKind.Currency:
      return enumValues && enumValues.length > 0
        ? rng.pick(enumValues)
        : rng.pick(CURRENCIES);
    case FieldKind.Date:
      return generateIsoDate(rng);
    case FieldKind.IsoTimestamp:
      return generateIsoTimestamp(rng);
    case FieldKind.Enum: {
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
      return generateUrl(rng);
    case FieldKind.Phone:
      return generatePhone(rng);
    case FieldKind.Street: {
      const n = rng.int(1, 9999);
      return `${n} ${rng.pick(STREETS)}`;
    }
    case FieldKind.City:
      return rng.pick(CITIES);
    case FieldKind.Zip:
      return generateZip(rng);
    case FieldKind.Country:
      return enumValues && enumValues.length > 0
        ? rng.pick(enumValues)
        : rng.pick(COUNTRIES);
    case FieldKind.Boolean:
      return rng.next() < 0.5;
    case FieldKind.FreeText:
      return generateFreeText(rng, samples);
    case FieldKind.Number:
      return generateNumber(rng, samples, false);
    case FieldKind.Integer:
      return generateNumber(rng, samples, true);
    case FieldKind.Null:
      return null;
    case FieldKind.Unknown:
    default: {
      const sample = samples.find((v) => v !== null && v !== undefined);
      if (typeof sample === 'string') return generateFreeText(rng, samples);
      if (typeof sample === 'number') {
        return generateNumber(rng, samples, Number.isInteger(sample));
      }
      if (typeof sample === 'boolean') return rng.next() < 0.5;
      return sample ?? null;
    }
  }
}
