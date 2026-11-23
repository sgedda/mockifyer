import { faker as enFaker } from '@faker-js/faker/locale/en';
import type { Faker } from '@faker-js/faker';
import {
  resolveLocaleCode,
  type SupportedLocale,
} from './context';
import { hashSeed } from './prng';

type LazyLocale = Exclude<SupportedLocale, 'en'>;

/**
 * Per-locale faker singletons. `en` is always present (static import).
 * Other locales are filled by {@link loadLocale} via dynamic `import()` so
 * bundlers can code-split them out of the main entry.
 *
 * Instances are re-seeded per {@link createSeededFaker} call. Generation is
 * synchronous, so a single-threaded caller is safe; do not interleave other
 * use of the same `@faker-js/faker/locale/*` singleton during `generate()`.
 */
const localeFakers: Map<SupportedLocale, Faker> = new Map([
  ['en', enFaker as Faker],
]);

const LAZY_LOADERS: Record<LazyLocale, () => Promise<{ faker: Faker }>> = {
  sv: () => import('@faker-js/faker/locale/sv') as Promise<{ faker: Faker }>,
  de: () => import('@faker-js/faker/locale/de') as Promise<{ faker: Faker }>,
  fr: () => import('@faker-js/faker/locale/fr') as Promise<{ faker: Faker }>,
  es: () => import('@faker-js/faker/locale/es') as Promise<{ faker: Faker }>,
};

const loadInflight = new Map<SupportedLocale, Promise<void>>();

/**
 * True when the locale is ready for sync {@link createSeededFaker} / {@link generate}.
 * `en` is always loaded.
 */
export function isLocaleLoaded(locale?: string | null): boolean {
  const code = resolveLocaleCode(locale);
  return localeFakers.has(code);
}

/**
 * Ensure a supported locale is available for sync generation.
 *
 * - `en` is a no-op (statically bundled).
 * - `sv` / `de` / `fr` / `es` are loaded once via dynamic `import()` of
 *   `@faker-js/faker/locale/<code>` so bundlers can emit separate async chunks.
 *
 * @example
 * ```ts
 * await loadLocale('sv');
 * generate(sample, { seed: 1, locale: 'sv' });
 * ```
 */
export async function loadLocale(locale?: string | null): Promise<SupportedLocale> {
  const code = resolveLocaleCode(locale);
  if (localeFakers.has(code)) {
    return code;
  }

  const existing = loadInflight.get(code);
  if (existing) {
    await existing;
    return code;
  }

  const lazy = code as LazyLocale;
  const loader = LAZY_LOADERS[lazy];
  if (!loader) {
    // resolveLocaleCode always returns a SupportedLocale; defend anyway
    throw new Error(`loadLocale(): unsupported locale "${String(locale)}"`);
  }

  const pending = (async () => {
    const mod = await loader();
    localeFakers.set(code, mod.faker);
  })();
  loadInflight.set(code, pending);
  try {
    await pending;
  } finally {
    loadInflight.delete(code);
  }
  return code;
}

/**
 * Create a seeded Faker for deterministic values.
 *
 * Sync API: `en` always works. Non-`en` locales require a prior
 * {@link loadLocale} (or {@link generateAsync}); otherwise throws.
 *
 * @throws {Error} when `locale` is not `en` and has not been loaded yet
 */
export function createSeededFaker(
  seed: number | string,
  locale?: string
): Faker {
  const code = resolveLocaleCode(locale);
  const faker = localeFakers.get(code);
  if (!faker) {
    throw new Error(
      `Locale "${code}" is not loaded. Call await loadLocale('${code}') or use generateAsync() before generate()/createSeededFaker().`
    );
  }
  // Re-seed the per-locale singleton for this record (sync generation is atomic).
  faker.seed(hashSeed(seed) || 1);
  return faker;
}

/** Test helper: drop lazy locales so sync generate throws again. */
export function __resetLoadedLocalesForTests(): void {
  for (const code of [...localeFakers.keys()]) {
    if (code !== 'en') {
      localeFakers.delete(code);
    }
  }
  loadInflight.clear();
}
