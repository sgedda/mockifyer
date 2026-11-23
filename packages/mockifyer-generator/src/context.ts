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

/**
 * Settings extracted from a free-text context string.
 * Explicit {@link GenerateOptions} fields override these when both are set.
 */
export interface ParsedContext {
  /** Faker locale code: `en` | `sv` | `de` | `fr` | `es`. */
  locale?: string;
  /** ISO 4217 currency code, e.g. `SEK`. */
  currency?: string;
  /** Suggested record count, e.g. from `"20 orders"`. */
  count?: number;
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

function parseLocale(text: string): SupportedLocale | undefined {
  // Prefer explicit language words / codes as whole tokens
  const tokenRe =
    /\b(swedish|svenska|english|german|deutsch|french|français|francais|spanish|español|espanol|sv-se|en-us|en-gb|de-de|fr-fr|es-es|sv|en|de|fr|es)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(text)) !== null) {
    const code = resolveLocaleCode(match[1]);
    // Only treat as a hit when the alias actually matched the token
    const key = match[1]!.toLowerCase().replace(/_/g, '-');
    if (LOCALE_ALIASES[key] || LOCALE_ALIASES[key.split('-')[0]!]) {
      return code;
    }
  }
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

function parseCount(text: string): number | undefined {
  const labeled = text.match(
    /\b(\d+)\s*(?:orders?|records?|items?|users?|rows?|entries?|datasets?|samples?|customers?)\b/i
  );
  if (labeled) {
    const n = Number(labeled[1]);
    if (Number.isInteger(n) && n >= 0) {
      return n;
    }
  }
  const explicit = text.match(/\b(?:count|generate|n)\s*[:=]?\s*(\d+)\b/i);
  if (explicit) {
    const n = Number(explicit[1]);
    if (Number.isInteger(n) && n >= 0) {
      return n;
    }
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

/**
 * Parse a short free-text context string into generation settings.
 *
 * @example
 * ```ts
 * parseContext('Swedish users, prices in SEK, 20 orders, mix of paid/refunded/failed');
 * // → { locale: 'sv', currency: 'SEK', count: 20, enumMix: { values: ['paid','refunded','failed'] } }
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

  const enumMix = parseEnumMix(trimmed);
  if (enumMix) {
    out.enumMix = enumMix;
  }

  return out;
}
