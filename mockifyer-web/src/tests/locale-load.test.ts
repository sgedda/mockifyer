/**
 * Unit tests for playground locale-chunk recovery (stale Vite hashes after redeploy).
 */
import {
  clearLocaleChunkReloadFlag,
  consumeLocaleChunkReload,
  isChunkLoadError,
  loadLocaleWithRecovery,
  LOCALE_CHUNK_RELOAD_KEY,
} from '../../frontend/src/lib/mock-data-generator/locale-load';

/** Minimal sessionStorage for Node Jest (locale reload guard). */
function installSessionStorage(): void {
  const store = new Map<string, string>();
  const api = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: api,
    configurable: true,
    writable: true,
  });
}

beforeAll(() => {
  installSessionStorage();
});

describe('isChunkLoadError', () => {
  it('detects Vite dynamic import failures', () => {
    expect(
      isChunkLoadError(
        new Error(
          'Failed to fetch dynamically imported module: https://example.com/assets/es-DLLH7dfQ.js'
        )
      )
    ).toBe(true);
  });

  it('detects webpack-style ChunkLoadError', () => {
    const err = new Error('Loading chunk 5 failed');
    err.name = 'ChunkLoadError';
    expect(isChunkLoadError(err)).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isChunkLoadError(new Error('Invalid JSON'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('loadLocaleWithRecovery', () => {
  beforeEach(() => {
    clearLocaleChunkReloadFlag();
  });

  afterEach(() => {
    clearLocaleChunkReloadFlag();
  });

  it('returns the requested locale on success', async () => {
    const loadLocale = jest.fn(async (code?: string | null) => String(code ?? 'en'));
    const result = await loadLocaleWithRecovery(loadLocale, 'es', { allowReload: false });
    expect(result).toEqual({ locale: 'es', fellBackToEn: false });
    expect(loadLocale).toHaveBeenCalledTimes(1);
  });

  it('retries once on chunk load failure then succeeds', async () => {
    const chunkErr = new Error(
      'Failed to fetch dynamically imported module: https://x/assets/es-OLD.js'
    );
    const loadLocale = jest
      .fn()
      .mockRejectedValueOnce(chunkErr)
      .mockResolvedValueOnce('es');
    const result = await loadLocaleWithRecovery(loadLocale, 'es', { allowReload: false });
    expect(result.locale).toBe('es');
    expect(result.fellBackToEn).toBe(false);
    expect(loadLocale).toHaveBeenCalledTimes(2);
  });

  it('falls back to en with a friendly message when reload is not allowed', async () => {
    const chunkErr = new Error(
      'Failed to fetch dynamically imported module: https://x/assets/es-OLD.js'
    );
    const loadLocale = jest
      .fn()
      .mockRejectedValueOnce(chunkErr)
      .mockRejectedValueOnce(chunkErr)
      .mockResolvedValueOnce('en');
    const result = await loadLocaleWithRecovery(loadLocale, 'es', { allowReload: false });
    expect(result.locale).toBe('en');
    expect(result.fellBackToEn).toBe(true);
    expect(result.message).toMatch(/“es”|English/i);
    expect(loadLocale).toHaveBeenCalledWith('en');
  });

  it('reloads once (guarded) then falls back on a second session failure', async () => {
    const chunkErr = new Error(
      'Failed to fetch dynamically imported module: https://x/assets/es-OLD.js'
    );
    const reload = jest.fn();
    const loadLocale = jest.fn().mockRejectedValue(chunkErr);

    await expect(
      loadLocaleWithRecovery(loadLocale, 'es', { reload, allowReload: true })
    ).rejects.toBe(chunkErr);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(LOCALE_CHUNK_RELOAD_KEY)).toBe('1');

    // Second failure in the same tab: reload already consumed → English fallback.
    loadLocale.mockReset();
    loadLocale
      .mockRejectedValueOnce(chunkErr)
      .mockRejectedValueOnce(chunkErr)
      .mockResolvedValueOnce('en');
    const result = await loadLocaleWithRecovery(loadLocale, 'es', {
      reload,
      allowReload: true,
    });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.fellBackToEn).toBe(true);
    expect(result.locale).toBe('en');
  });

  it('consumeLocaleChunkReload is one-shot per tab session', () => {
    expect(consumeLocaleChunkReload()).toBe(true);
    expect(consumeLocaleChunkReload()).toBe(false);
    clearLocaleChunkReloadFlag();
    expect(consumeLocaleChunkReload()).toBe(true);
  });
});
