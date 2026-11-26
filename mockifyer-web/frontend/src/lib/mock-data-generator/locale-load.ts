/**
 * Robust locale chunk loading for the playground.
 *
 * After a Railway redeploy, browsers can keep an old generator module in memory
 * that still imports a removed hashed locale file (e.g. es-DLLH7dfQ.js → 404).
 * HTML is no-cache; hashed assets are immutable — recovery is required.
 */

export const LOCALE_CHUNK_RELOAD_KEY = 'mockifyer-mdg-locale-chunk-reload'

export function isChunkLoadError(err: unknown): boolean {
  if (err == null) return false
  const message = err instanceof Error ? err.message : String(err)
  const name = err instanceof Error ? err.name : ''
  return (
    name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  )
}

/** Returns true once per tab session — caller should reload then. */
export function consumeLocaleChunkReload(): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    if (sessionStorage.getItem(LOCALE_CHUNK_RELOAD_KEY) === '1') {
      return false
    }
    sessionStorage.setItem(LOCALE_CHUNK_RELOAD_KEY, '1')
    return true
  } catch {
    return false
  }
}

export function clearLocaleChunkReloadFlag(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(LOCALE_CHUNK_RELOAD_KEY)
  } catch {
    // ignore
  }
}

export interface LocaleLoadResult {
  /** Locale actually used for generation. */
  locale: string
  /** True when we fell back to `en` after chunk failures. */
  fellBackToEn: boolean
  /** User-facing note when fellBackToEn. */
  message?: string
}

/**
 * Load a locale with: attempt → retry once → optional full page reload once →
 * fall back to English with a friendly message.
 */
export async function loadLocaleWithRecovery(
  loadLocale: (locale?: string | null) => Promise<string>,
  requested: string,
  opts?: {
    /** Injected for tests. */
    reload?: () => void
    /** Injected for tests — skip actual reload. */
    allowReload?: boolean
  }
): Promise<LocaleLoadResult> {
  const tryLoad = async (code: string) => {
    await loadLocale(code)
    return code
  }

  try {
    const locale = await tryLoad(requested)
    clearLocaleChunkReloadFlag()
    return { locale, fellBackToEn: false }
  } catch (first) {
    if (!isChunkLoadError(first) || requested === 'en') {
      throw first
    }
    try {
      const locale = await tryLoad(requested)
      clearLocaleChunkReloadFlag()
      return { locale, fellBackToEn: false }
    } catch (second) {
      if (!isChunkLoadError(second)) {
        throw second
      }
      const allowReload = opts?.allowReload !== false
      if (allowReload && consumeLocaleChunkReload()) {
        const reload = opts?.reload ?? (() => window.location.reload())
        reload()
        // Page is unloading; still throw so callers don't continue with stale UI.
        throw second
      }
      await tryLoad('en')
      return {
        locale: 'en',
        fellBackToEn: true,
        message: `Could not load the “${requested}” language pack (stale or missing file after a deploy). Showing English instead — refresh the page to retry.`,
      }
    }
  }
}
