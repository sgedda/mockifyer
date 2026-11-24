/**
 * Offline free-text context parsing for {@link generate} (SGE-71).
 * No network / AI — regex + small locale / currency maps only.
 */

/** Weighted enum values for status-like fields. */
export interface EnumMix {
  values: string[];
  /** Relative weights aligned with `values` (e.g. percentages). */
  weights?: number[];
}

/** Built-in default sample shapes when no JSON sample is provided. */
export type ContextEntity = 'user' | 'order' | 'product';

/**
 * Settings extracted from a free-text context string.
 * Explicit {@link GenerateOptions} fields override these when both are set.
 */
export interface ParsedContext {
  /** Faker locale code: `en` | `sv` | `de` | `fr` | `es`. */
  locale?: string;
  /** ISO 4217 currency code, e.g. `SEK`. */
  currency?: string;
  /**
   * Root record count from `"10 orders"` / `"5 users"` / etc.
   * Not from `"N items"` — that sets {@link itemCount}.
   */
  count?: number;
  /**
   * Nested line-item array length from `"5 items"`, `"3 items each"`,
   * `"3 line items"`, `"3 products in each"`.
   */
  itemCount?: number;
  /** Inferred entity for choosing a built-in default sample shape. */
  entity?: ContextEntity;
  /** Enum values (and optional weights) for status-like fields. */
  enumMix?: EnumMix;
}

/** Supported faker locale codes (keep small for browser bundles). */
export const SUPPORTED_LOCALES = ['en', 'sv', 'de', 'fr', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Default ISO 4217 currency when a locale is set but no currency was specified
 * in context / options. `en` has no default (sample / faker currency stands).
 */
export const LOCALE_DEFAULT_CURRENCY: Readonly<
  Partial<Record<SupportedLocale, string>>
> = {
  sv: 'SEK',
  de: 'EUR',
  fr: 'EUR',
  es: 'EUR',
};

const LOCALE_ALIASES: Record<string, SupportedLocale> = {
  en: 'en',
  eng: 'en',
  english: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  'en-au': 'en',
  sv: 'sv',
  swe: 'sv',
  swedish: 'sv',
  svenska: 'sv',
  'sv-se': 'sv',
  de: 'de',
  ger: 'de',
  deu: 'de',
  german: 'de',
  deutsch: 'de',
  'de-de': 'de',
  'de-at': 'de',
  fr: 'fr',
  fre: 'fr',
  fra: 'fr',
  french: 'fr',
  francais: 'fr',
  français: 'fr',
  'fr-fr': 'fr',
  'fr-ca': 'fr',
  es: 'es',
  spa: 'es',
  spanish: 'es',
  espanol: 'es',
  español: 'es',
  'es-es': 'es',
  'es-mx': 'es',
};

/** Full language names / long aliases — safe as free-text tokens. */
const LOCALE_NAME_TOKENS =
  'swedish|svenska|english|german|deutsch|french|français|francais|spanish|español|espanol';

/** Region tags that unambiguously name a locale. */
const LOCALE_REGION_TAGS =
  'sv-se|en-us|en-gb|en-au|de-de|de-at|fr-fr|fr-ca|es-es|es-mx';

/** Bare 2-letter codes — only via marker / whole-string / region tag. */
const BARE_LOCALE_CODES = new Set(['en', 'sv', 'de', 'fr', 'es']);

/** Common ISO 4217 codes we accept from free text (uppercase). */
const KNOWN_CURRENCIES = new Set([
  'USD',
  'EUR',
  'GBP',
  'SEK',
  'NOK',
  'DKK',
  'CHF',
  'JPY',
  'CNY',
  'CAD',
  'AUD',
  'NZD',
  'INR',
  'BRL',
  'MXN',
  'PLN',
  'CZK',
  'HUF',
  'TRY',
  'ZAR',
  'KRW',
  'SGD',
  'HKD',
  'ILS',
  'AED',
  'THB',
  'MYR',
  'PHP',
  'IDR',
  'RUB',
]);

/** Nouns that set root record {@link ParsedContext.count}. */
const RECORD_COUNT_NOUNS =
  'orders?|records?|users?|rows?|entries?|datasets?|samples?|customers?|people|persons?|products?|skus?';

/** Remove item-length phrases so they do not double as record counts. */
function stripItemCountPhrases(text: string): string {
  return text
    .replace(/\b\d+\s*line\s*items?\b/gi, ' ')
    .replace(/\b\d+\s*(?:items?|products?|skus?)\s+in\s+each\b/gi, ' ')
    .replace(/\b\d+\s*(?:items?|products?|skus?)\s+each\b/gi, ' ')
    .replace(
      /\beach\s+(?:with\s+)?\d+\s*(?:items?|products?|line\s*items?|skus?)\b/gi,
      ' '
    )
    .replace(/\b\d+\s*items?\b/gi, ' ');
}

/**
 * Resolve a language name or locale tag to a supported faker locale code.
 * Returns `null` when the input is empty or unrecognized (no silent `en` fallback).
 */
export function tryResolveLocale(
  input: string | undefined | null
): SupportedLocale | null {
  if (input == null || String(input).trim() === '') {
    return null;
  }
  const key = String(input).trim().toLowerCase().replace(/_/g, '-');
  if (LOCALE_ALIASES[key]) {
    return LOCALE_ALIASES[key];
  }
  const base = key.split('-')[0] ?? key;
  return LOCALE_ALIASES[base] ?? null;
}

/**
 * Map a language name or locale tag to a supported faker locale code.
 * Unknown input falls back to `en`.
 */
export function resolveLocaleCode(input: string | undefined | null): SupportedLocale {
  return tryResolveLocale(input) ?? 'en';
}

/**
 * Detect locale from free text.
 *
 * Bare codes (`en`/`sv`/…) only count when:
 * - the whole string is just that code (or a region tag like `sv-SE`), or
 * - marked as `locale sv` / `lang: de` / `language fr`.
 * Ordinary words like Swedish `en` ("a") must not resolve to English.
 * Full language names (`swedish`, `svenska`, …) still match as tokens.
 */
function parseLocale(text: string): SupportedLocale | undefined {
  const trimmed = text.trim();
  const wholeKey = trimmed.toLowerCase().replace(/_/g, '-');

  // Whole string is a bare code or region tag
  if (/^(en|sv|de|fr|es)(-[a-z]{2})?$/i.test(trimmed)) {
    const code = tryResolveLocale(trimmed);
    if (code) return code;
  }

  // Explicit markers: locale sv / lang: de / language=fr
  const marked = trimmed.match(
    /\b(?:locale|lang|language)\s*[:=]?\s*([A-Za-z]{2,12}(?:-[A-Za-z]{2})?)\b/i
  );
  if (marked) {
    const code = tryResolveLocale(marked[1]);
    if (code) return code;
  }

  // Region tags as tokens (sv-SE, en-US, …)
  const regionRe = new RegExp(`\\b(${LOCALE_REGION_TAGS})\\b`, 'gi');
  const regionMatch = regionRe.exec(trimmed);
  if (regionMatch) {
    return resolveLocaleCode(regionMatch[1]);
  }

  // Full language names only — never bare 2-letter codes as free tokens
  const nameRe = new RegExp(`\\b(${LOCALE_NAME_TOKENS})\\b`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = nameRe.exec(trimmed)) !== null) {
    const key = match[1]!.toLowerCase().replace(/_/g, '-');
    if (BARE_LOCALE_CODES.has(key)) {
      continue;
    }
    const code = tryResolveLocale(match[1]);
    if (code) return code;
  }

  // Avoid unused var lint for wholeKey in edge paths
  void wholeKey;
  return undefined;
}

function parseCurrency(text: string): string | undefined {
  const tagged =
    text.match(
      /(?:currency|currencies|prices?\s+in|amounts?\s+in|in)\s*[:\s]*([A-Za-z]{3})\b/i
    ) ?? text.match(/\b([A-Za-z]{3})\s*(?:currency|prices?)\b/i);
  if (tagged) {
    const code = tagged[1]!.toUpperCase();
    if (KNOWN_CURRENCIES.has(code)) {
      return code;
    }
  }

  const loose = text.match(/\b([A-Z]{3})\b/g);
  if (loose) {
    for (const code of loose) {
      if (KNOWN_CURRENCIES.has(code)) {
        return code;
      }
    }
  }
  return undefined;
}

/**
 * Root record count — `"10 orders"`, `"5 users"`, `"10 products"`, `count: 3`.
 * Does **not** treat `"N items"` / `"N products each"` as record count
 * (see {@link parseItemCount}).
 */
function parseCount(text: string): number | undefined {
  const withoutItems = stripItemCountPhrases(text);
  const labeled = withoutItems.match(
    new RegExp(`\\b(\\d+)\\s*(?:${RECORD_COUNT_NOUNS})\\b`, 'i')
  );
  if (labeled) {
    const n = Number(labeled[1]);
    if (Number.isInteger(n) && n >= 0) {
      return n;
    }
  }
  const explicit = withoutItems.match(/\b(?:count|generate|n)\s*[:=]?\s*(\d+)\b/i);
  if (explicit) {
    const n = Number(explicit[1]);
    if (Number.isInteger(n) && n >= 0) {
      return n;
    }
  }
  return undefined;
}

/**
 * Nested line-item length — `"5 items"`, `"3 items each"`,
 * `"3 line items"`, `"3 products in each"`.
 */
function parseItemCount(text: string): number | undefined {
  const patterns = [
    /\b(\d+)\s*line\s*items?\b/i,
    /\b(\d+)\s*(?:items?|products?|skus?)\s+in\s+each\b/i,
    /\b(\d+)\s*(?:items?|products?|skus?)\s+each\b/i,
    /\beach\s+(?:with\s+)?(\d+)\s*(?:items?|products?|line\s*items?|skus?)\b/i,
    /\b(\d+)\s*items?\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isInteger(n) && n >= 0) {
      return n;
    }
  }
  return undefined;
}

/**
 * Infer which built-in sample shape to use when no JSON sample is provided.
 */
function parseEntity(text: string): ContextEntity | undefined {
  // Prefer more specific product wording before generic "items"
  if (/\b(products?|skus?)\b/i.test(text) && !/\borders?\b/i.test(text)) {
    // "3 products in each" is item-length under orders — still order-shaped
    if (/\b\d+\s*products?\s+(?:in\s+)?each\b/i.test(text)) {
      return undefined;
    }
    return 'product';
  }
  if (/\b(users?|customers?|people|persons?)\b/i.test(text)) {
    return 'user';
  }
  if (/\borders?\b/i.test(text)) {
    return 'order';
  }
  return undefined;
}

function parseEnumMix(text: string): EnumMix | undefined {
  const weightMatches = [...text.matchAll(/(\d+)\s*%\s*([A-Za-z][A-Za-z0-9_-]*)/g)];
  if (weightMatches.length >= 2) {
    return {
      values: weightMatches.map((m) => m[2]!),
      weights: weightMatches.map((m) => Number(m[1])),
    };
  }

  const mixMatch = text.match(/\bmix\s+of\s+(.+?)(?:[.;]|$)/i);
  if (!mixMatch) {
    return undefined;
  }
  const values = mixMatch[1]!
    .split(/\s*(?:\/|,|\||\band\b)\s*/i)
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(s));
  if (values.length < 2) {
    return undefined;
  }
  return { values };
}

/** Built-in samples for context-only generation (no input JSON file). */
export const DEFAULT_ENTITY_SAMPLES: Readonly<Record<ContextEntity, unknown>> = {
  user: {
    id: 1,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+15550100',
    city: 'Stockholm',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  order: {
    id: 1,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    status: 'active',
    currency: 'USD',
    total: 19.99,
    items: [{ id: 10, name: 'Widget', qty: 2, price: 9.99 }],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
  product: {
    id: 1,
    name: 'Widget',
    price: 19.99,
    currency: 'USD',
    sku: 'SKU-001',
  },
};

/**
 * Pick a built-in sample for context-only generation.
 * Unknown / missing entity → order-shaped default (current CLI default).
 */
export function defaultSampleForEntity(entity?: ContextEntity | null): unknown {
  if (entity && DEFAULT_ENTITY_SAMPLES[entity]) {
    return DEFAULT_ENTITY_SAMPLES[entity];
  }
  return DEFAULT_ENTITY_SAMPLES.order;
}

/**
 * Parse a short free-text context string into generation settings.
 *
 * @example
 * ```ts
 * parseContext('Swedish users, prices in SEK, 20 orders, mix of paid/refunded/failed');
 * // → { locale: 'sv', currency: 'SEK', count: 20, entity: 'user', enumMix: … }
 *
 * parseContext('swedish users, 5 items');
 * // → { locale: 'sv', entity: 'user', itemCount: 5 }  // record count defaults to 1
 *
 * parseContext('10 orders, 3 items each, prices in EUR');
 * // → { count: 10, itemCount: 3, currency: 'EUR', entity: 'order' }
 * ```
 */
export function parseContext(text: string): ParsedContext {
  if (typeof text !== 'string' || text.trim() === '') {
    return {};
  }
  const trimmed = text.trim();
  const out: ParsedContext = {};

  const locale = parseLocale(trimmed);
  if (locale) {
    out.locale = locale;
  }

  const currency = parseCurrency(trimmed);
  if (currency) {
    out.currency = currency;
  }

  const count = parseCount(trimmed);
  if (count !== undefined) {
    out.count = count;
  }

  const itemCount = parseItemCount(trimmed);
  if (itemCount !== undefined) {
    out.itemCount = itemCount;
  }

  const entity = parseEntity(trimmed);
  if (entity) {
    out.entity = entity;
  }

  const enumMix = parseEnumMix(trimmed);
  if (enumMix) {
    out.enumMix = enumMix;
  }

  return out;
}
