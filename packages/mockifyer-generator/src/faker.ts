import { Faker, base, de, en, es, fr, sv } from '@faker-js/faker';
import type { LocaleDefinition } from '@faker-js/faker';
import { resolveLocaleCode, type SupportedLocale } from './context';
import { hashSeed } from './prng';

const LOCALE_DEFINITIONS: Record<SupportedLocale, LocaleDefinition> = {
  en,
  sv,
  de,
  fr,
  es,
};

/**
 * Create a Faker instance seeded for deterministic output.
 *
 * Only the selected locales (`en`, `sv`, `de`, `fr`, `es`) are imported so
 * browser bundles stay reasonable. Always includes `base` (and `en` as
 * fallback for incomplete locales) per faker localization rules.
 */
export function createSeededFaker(
  seed: number | string,
  locale?: string
): Faker {
  const code = resolveLocaleCode(locale);
  const primary = LOCALE_DEFINITIONS[code];
  const localeChain: LocaleDefinition[] =
    code === 'en' ? [en, base] : [primary, en, base];
  const faker = new Faker({ locale: localeChain });
  // faker.seed expects number | number[]; use our FNV-hashed 32-bit int
  faker.seed(hashSeed(seed) || 1);
  return faker;
}
