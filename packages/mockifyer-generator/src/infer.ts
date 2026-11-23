import { FieldKind, type FieldDescriptor, type FieldKindOverrides, type InferResult } from './types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;
const PHONE_RE = /^\+?[\d\s().-]{7,20}$/;
const CURRENCY_CODE_RE = /^[A-Z]{3}$/;

/** Max distinct string values before we stop treating a field as enum-like. */
const ENUM_MAX_CARDINALITY = 12;

interface PathAccum {
  path: string;
  key: string;
  samples: unknown[];
  arrayLength?: number;
  isArrayContainer: boolean;
}

interface KindGuess {
  kind: FieldKind;
  confidence: number;
}

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function lastSegment(path: string): string {
  const cleaned = path.replace(/\[\*\]/g, '').replace(/\$\.?/, '');
  const parts = cleaned.split('.').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

function joinPath(parent: string, key: string | number, isArrayIndex = false): string {
  if (isArrayIndex) {
    return `${parent}[*]`;
  }
  if (parent === '$') {
    return `$.${key}`;
  }
  return `${parent}.${key}`;
}

/**
 * Normalize override keys so `orders[*].status`, `$.orders[*].status`, and
 * `$.orders.status` can match inferred paths.
 */
export function normalizeOverridePath(path: string): string {
  let p = path.trim();
  if (!p.startsWith('$')) {
    p = p.startsWith('.') ? `$${p}` : `$.${p}`;
  }
  return p;
}

function parseOverrideKind(raw: FieldKind | string): FieldKind | null {
  if (typeof raw !== 'string') {
    return raw;
  }
  const values = Object.values(FieldKind) as string[];
  if (values.includes(raw)) {
    return raw as FieldKind;
  }
  const byKey = (FieldKind as Record<string, FieldKind>)[raw];
  return byKey ?? null;
}

function confidenceFromSignals(nameHit: boolean, valueHit: boolean, strongValue: boolean): number {
  if (strongValue && nameHit) return 0.98;
  if (strongValue) return 0.92;
  if (nameHit && valueHit) return 0.9;
  if (nameHit) return 0.75;
  if (valueHit) return 0.7;
  return 0.4;
}

/** Line-item / catalog array segments where `name` means a product, not a person. */
const LINE_ITEM_ARRAY_SEGMENTS = new Set([
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
]);

/**
 * True when `path` looks like `$.items[*].name` / `$.order.items[*].title`
 * (product title under a line-item array), not a person `name`.
 */
export function isLineItemProductNamePath(path: string, key: string): boolean {
  const nk = normalizeKey(key);
  if (nk !== 'name' && nk !== 'title' && nk !== 'productname' && nk !== 'product') {
    return false;
  }
  // Match …items[*].name / …products[*].title (optional nested parents)
  const segments = path
    .replace(/^\$\.?/, '')
    .split('.')
    .filter(Boolean)
    .map((s) => s.replace(/\[\*\]$/, '').replace(/\[\d+\]$/, ''));
  if (segments.length < 2) {
    return false;
  }
  const parent = segments[segments.length - 2]!;
  return LINE_ITEM_ARRAY_SEGMENTS.has(normalizeKey(parent));
}

/**
 * Infer a single field kind from its key name and observed values.
 * Exported for unit tests of tricky names.
 *
 * Pass `path` (e.g. `$.items[*].name`) so line-item titles are not treated as people.
 */
export function inferFieldKind(
  key: string,
  samples: unknown[],
  path?: string
): KindGuess {
  if (path && isLineItemProductNamePath(path, key)) {
    return { kind: FieldKind.ProductName, confidence: 0.9 };
  }

  const nk = normalizeKey(key);
  const nonNull = samples.filter((v) => v !== null && v !== undefined);
  const strings = nonNull.filter((v): v is string => typeof v === 'string');
  const numbers = nonNull.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const booleans = nonNull.filter((v): v is boolean => typeof v === 'boolean');

  if (nonNull.length === 0) {
    return { kind: FieldKind.Null, confidence: 0.6 };
  }

  if (booleans.length === nonNull.length) {
    return { kind: FieldKind.Boolean, confidence: 0.99 };
  }

  const nameEmail = /^(email|emailaddress|useremail|mail)$/.test(nk) || nk.endsWith('email');
  const nameFirst = /^(firstname|fname|givenname|first)$/.test(nk);
  const nameLast = /^(lastname|lname|surname|familyname|last)$/.test(nk);
  const nameFull =
    /^(fullname|displayname|customername)$/.test(nk) ||
    nk === 'name' ||
    (nk.endsWith('name') && !nameFirst && !nameLast && !nameEmail);
  const nameUuid =
    /^(uuid|guid)$/.test(nk) || nk.endsWith('uuid') || nk.endsWith('guid');
  const nameIntId =
    /^(id|userid|orderid|productid|itemid|customerid|accountid|pk|rowid)$/.test(nk) ||
    (nk.endsWith('id') && !nameUuid);
  const nameMoney =
    /^(price|amount|total|subtotal|cost|fee|balance|salary|revenue|unitprice|linetotal)$/.test(
      nk
    );
  const nameCurrency = /^(currency|currencycode|curr)$/.test(nk);
  const nameDate =
    /^(date|dob|birthdate|birthday)$/.test(nk) ||
    (nk.endsWith('date') && !nk.includes('update'));
  const nameTs =
    /^(timestamp|createdat|updatedat|deletedat|publishedat|expiresat|startsat|endsat)$/.test(
      nk
    ) ||
    /(?:At|_at|Time|_time)$/.test(key) ||
    nk.includes('datetime') ||
    nk === 'timestamp';
  const nameUrl =
    /^(url|href|link|website|avatarurl|imageurl|thumbnail)$/.test(nk) || nk.endsWith('url');
  const namePhone =
    /^(phone|phonenumber|mobile|tel|cellphone)$/.test(nk) || nk.endsWith('phone');
  const nameStreet = /^(street|street1|address1|addressline1|line1)$/.test(nk);
  const nameCity = /^(city|town|locality)$/.test(nk);
  const nameZip = /^(zip|zipcode|postal|postcode|postalcode)$/.test(nk);
  const nameCountry = /^(country|countrycode|nation)$/.test(nk);
  const nameStatusLike = /^(status|state|type|kind|role|level|tier|phase|mode|category)$/.test(
    nk
  );

  const allUuid = strings.length > 0 && strings.every((s) => UUID_RE.test(s));
  const allEmail = strings.length > 0 && strings.every((s) => EMAIL_RE.test(s));
  const allIsoTs = strings.length > 0 && strings.every((s) => ISO_TIMESTAMP_RE.test(s));
  const allIsoDate = strings.length > 0 && strings.every((s) => ISO_DATE_RE.test(s));
  const allUrl = strings.length > 0 && strings.every((s) => URL_RE.test(s));
  const allPhone =
    strings.length > 0 && strings.every((s) => PHONE_RE.test(s) && /\d{3,}/.test(s));
  const allCurrency = strings.length > 0 && strings.every((s) => CURRENCY_CODE_RE.test(s));
  const allInts = numbers.length > 0 && numbers.every((n) => Number.isInteger(n));
  const moneyishNumbers =
    numbers.length > 0 &&
    numbers.some((n) => !Number.isInteger(n) || Math.abs(n) >= 10);

  if (allEmail || (nameEmail && strings.length > 0)) {
    return {
      kind: FieldKind.Email,
      confidence: confidenceFromSignals(nameEmail, allEmail, allEmail),
    };
  }
  if (allUuid || (nameUuid && strings.length > 0)) {
    return {
      kind: FieldKind.Uuid,
      confidence: confidenceFromSignals(nameUuid, allUuid, allUuid),
    };
  }
  // UUID-shaped values under a generic *id key
  if (allUuid && nameIntId) {
    return { kind: FieldKind.Uuid, confidence: 0.95 };
  }
  if (nameFirst) {
    return { kind: FieldKind.FirstName, confidence: 0.85 };
  }
  if (nameLast) {
    return { kind: FieldKind.LastName, confidence: 0.85 };
  }
  if (nameFull && !nameEmail && !nameUuid && !nameStatusLike) {
    return { kind: FieldKind.FullName, confidence: nk === 'name' ? 0.7 : 0.82 };
  }
  // Dates before phone — ISO dates look phone-like to a loose digit/dash regex.
  if (allIsoTs || (nameTs && (allIsoTs || allIsoDate || strings.length > 0))) {
    return {
      kind: FieldKind.IsoTimestamp,
      confidence: confidenceFromSignals(nameTs, allIsoTs, allIsoTs),
    };
  }
  if (allIsoDate || (nameDate && strings.length > 0)) {
    return {
      kind: FieldKind.Date,
      confidence: confidenceFromSignals(nameDate, allIsoDate, allIsoDate),
    };
  }
  if (allUrl || (nameUrl && strings.length > 0)) {
    return {
      kind: FieldKind.Url,
      confidence: confidenceFromSignals(nameUrl, allUrl, allUrl),
    };
  }
  if (allPhone || (namePhone && strings.length > 0)) {
    return {
      kind: FieldKind.Phone,
      confidence: confidenceFromSignals(namePhone, allPhone, allPhone),
    };
  }
  if (nameStreet) {
    return { kind: FieldKind.Street, confidence: 0.85 };
  }
  if (nameCity) {
    return { kind: FieldKind.City, confidence: 0.85 };
  }
  if (nameZip) {
    return { kind: FieldKind.Zip, confidence: 0.85 };
  }
  if (nameCountry) {
    return { kind: FieldKind.Country, confidence: 0.85 };
  }
  if (nameCurrency || (allCurrency && !nameCountry)) {
    return {
      kind: FieldKind.Currency,
      confidence: confidenceFromSignals(nameCurrency, allCurrency, allCurrency),
    };
  }
  if (nameMoney && (numbers.length > 0 || moneyishNumbers)) {
    return { kind: FieldKind.Money, confidence: 0.88 };
  }
  if (nameIntId && (allInts || numbers.length > 0) && !allUuid) {
    return { kind: FieldKind.IntegerId, confidence: allInts ? 0.9 : 0.8 };
  }

  if (strings.length === nonNull.length && strings.length > 0) {
    const distinct = [...new Set(strings)];
    if (distinct.length <= ENUM_MAX_CARDINALITY) {
      const shortValues = distinct.every(
        (s) => s.length > 0 && s.length <= 40 && !/\s{2,}/.test(s)
      );
      if (
        shortValues &&
        (nameStatusLike ||
          distinct.length <= Math.max(3, Math.ceil(strings.length * 0.5)))
      ) {
        return {
          kind: FieldKind.Enum,
          confidence: nameStatusLike ? 0.9 : 0.72,
        };
      }
    }
  }

  if (allInts && numbers.length === nonNull.length) {
    return { kind: FieldKind.Integer, confidence: 0.7 };
  }
  if (numbers.length === nonNull.length) {
    return { kind: FieldKind.Number, confidence: 0.7 };
  }
  if (strings.length === nonNull.length) {
    const avgLen = strings.reduce((a, s) => a + s.length, 0) / Math.max(1, strings.length);
    return { kind: FieldKind.FreeText, confidence: avgLen > 40 ? 0.65 : 0.55 };
  }

  return { kind: FieldKind.Unknown, confidence: 0.3 };
}

function walk(value: unknown, path: string, key: string, acc: Map<string, PathAccum>): void {
  if (value === null || value === undefined) {
    const existing = acc.get(path);
    if (existing) {
      existing.samples.push(value);
    } else {
      acc.set(path, { path, key, samples: [value], isArrayContainer: false });
    }
    return;
  }

  if (Array.isArray(value)) {
    const existing = acc.get(path);
    if (existing) {
      existing.arrayLength = Math.max(existing.arrayLength ?? 0, value.length);
      existing.isArrayContainer = true;
    } else {
      acc.set(path, {
        path,
        key,
        samples: [],
        arrayLength: value.length,
        isArrayContainer: true,
      });
    }
    const itemPath = joinPath(path, 0, true);
    for (const item of value) {
      walk(item, itemPath, key, acc);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const [childKey, childVal] of Object.entries(value as Record<string, unknown>)) {
      walk(childVal, joinPath(path, childKey), childKey, acc);
    }
    return;
  }

  const existing = acc.get(path);
  if (existing) {
    existing.samples.push(value);
  } else {
    acc.set(path, { path, key, samples: [value], isArrayContainer: false });
  }
}

/** Loose path equality: `$.a[*].b` matches `$.a.b` override forms. */
function pathsMatch(overridePath: string, inferredPath: string): boolean {
  const norm = (p: string) =>
    normalizeOverridePath(p)
      .replace(/\[\*\]/g, '')
      .replace(/\[(\d+)\]/g, '');
  return norm(overridePath) === norm(inferredPath);
}

/**
 * Infer field descriptors for every leaf (and array container) under `sample`.
 *
 * When `sample` is an array of records, kinds are merged across all items and
 * enum values are collected from the whole set.
 */
export function inferFields(
  sample: unknown,
  overrides?: FieldKindOverrides
): InferResult {
  const rootIsArray = Array.isArray(sample);
  const acc = new Map<string, PathAccum>();
  walk(sample, '$', '', acc);

  const overrideMap = new Map<string, FieldKind>();
  if (overrides) {
    for (const [rawPath, rawKind] of Object.entries(overrides)) {
      const kind = parseOverrideKind(rawKind);
      if (!kind) continue;
      overrideMap.set(normalizeOverridePath(rawPath), kind);
    }
  }

  const fields: FieldDescriptor[] = [];

  for (const entry of acc.values()) {
    if (entry.isArrayContainer && entry.samples.length === 0) {
      fields.push({
        path: entry.path,
        kind: FieldKind.Unknown,
        confidence: 0.5,
        samples: [],
        arrayLength: entry.arrayLength,
      });
      continue;
    }

    const key = entry.key || lastSegment(entry.path);
    let guess = inferFieldKind(key, entry.samples, entry.path);

    let resolvedOverride = overrideMap.get(entry.path);
    if (!resolvedOverride) {
      for (const [op, ok] of overrideMap) {
        if (pathsMatch(op, entry.path)) {
          resolvedOverride = ok;
          break;
        }
      }
    }

    if (resolvedOverride) {
      guess = { kind: resolvedOverride, confidence: 1 };
    }

    const distinctStrings =
      guess.kind === FieldKind.Enum
        ? [...new Set(entry.samples.filter((v): v is string => typeof v === 'string'))]
        : undefined;

    fields.push({
      path: entry.path,
      kind: guess.kind,
      confidence: guess.confidence,
      samples: entry.samples.slice(0, 20),
      enumValues: distinctStrings,
      arrayLength: entry.arrayLength,
    });
  }

  fields.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { fields, rootIsArray };
}
