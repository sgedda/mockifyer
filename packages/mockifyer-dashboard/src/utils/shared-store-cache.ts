interface ClosableStore {
  close(): Promise<void>;
}

interface CachedStoreEntry<T> {
  store: T;
  dispose: () => Promise<void>;
}

export interface SharedStoreCache<T extends ClosableStore> {
  /** Return the store cached under `key`, creating it on first use. */
  getOrCreate(key: string, create: () => T): T;
  /** Close every cached store and empty the cache (tests / process shutdown). */
  closeAll(): Promise<void>;
}

/**
 * Process-wide cache of Redis/SQLite-backed stores keyed by connection settings.
 * `close()` on a cached store is a no-op so request handlers can keep calling it
 * without tearing down the shared connection; {@link SharedStoreCache.closeAll} disposes for real.
 */
export function createSharedStoreCache<T extends ClosableStore>(): SharedStoreCache<T> {
  const entries = new Map<string, CachedStoreEntry<T>>();

  return {
    getOrCreate(key, create) {
      const cached = entries.get(key);
      if (cached) return cached.store;

      const store = create();
      const dispose = store.close.bind(store);
      store.close = async () => undefined;
      entries.set(key, { store, dispose });
      return store;
    },

    async closeAll() {
      const all = [...entries.values()];
      entries.clear();
      for (const entry of all) {
        await entry.dispose().catch(() => undefined);
      }
    },
  };
}
