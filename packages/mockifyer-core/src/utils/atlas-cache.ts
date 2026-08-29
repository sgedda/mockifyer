import type { AtlasDatasourceKind, AtlasDatasourceRef } from './atlas';

export interface AtlasCacheEntry<T = unknown> {
  data: T;
  requestId: string;
  kind?: AtlasDatasourceKind;
  operation?: string;
  fetchedAt?: string;
}

export interface AtlasCacheRegistryOptions {
  /** Called when getCache records an access (optional). */
  onAccess?: (datasourceId: string) => void;
}

/**
 * Keyed datasource cache with access tracking for atlas attribution.
 * Use during `buildProps` / `resolveNodeData` so presentation events list only
 * datasources actually read for that CMS node.
 */
export function createCacheRegistry(options?: AtlasCacheRegistryOptions) {
  const stores = new Map<string, AtlasCacheEntry>();
  let tracking = false;
  const accessed = new Set<string>();

  function set(datasourceId: string, entry: AtlasCacheEntry): void {
    stores.set(datasourceId, entry);
  }

  function getCache<T = unknown>(datasourceId: string): AtlasCacheEntry<T> | undefined {
    if (tracking) {
      accessed.add(datasourceId);
      options?.onAccess?.(datasourceId);
    }
    return stores.get(datasourceId) as AtlasCacheEntry<T> | undefined;
  }

  function has(datasourceId: string): boolean {
    return stores.has(datasourceId);
  }

  function clearAccessTracking(): void {
    accessed.clear();
  }

  function beginAccessTracking(): void {
    accessed.clear();
    tracking = true;
  }

  function endAccessTracking(): AtlasDatasourceRef[] {
    tracking = false;
    const refs: AtlasDatasourceRef[] = [];
    for (const id of accessed) {
      const entry = stores.get(id);
      if (!entry) continue;
      refs.push({
        datasourceId: id,
        requestId: entry.requestId,
        kind: entry.kind,
        operation: entry.operation,
        source: 'cache',
      });
    }
    accessed.clear();
    return refs;
  }

  /**
   * Run `fn` while tracking which caches are read; returns result + datasource refs.
   */
  function trackAccess<T>(fn: () => T): { result: T; datasources: AtlasDatasourceRef[] } {
    beginAccessTracking();
    try {
      const result = fn();
      const datasources = endAccessTracking();
      return { result, datasources };
    } catch (error) {
      endAccessTracking();
      throw error;
    }
  }

  async function trackAccessAsync<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; datasources: AtlasDatasourceRef[] }> {
    beginAccessTracking();
    try {
      const result = await fn();
      const datasources = endAccessTracking();
      return { result, datasources };
    } catch (error) {
      endAccessTracking();
      throw error;
    }
  }

  function listIds(): string[] {
    return [...stores.keys()];
  }

  function clear(): void {
    stores.clear();
    accessed.clear();
    tracking = false;
  }

  return {
    set,
    getCache,
    has,
    clearAccessTracking,
    beginAccessTracking,
    endAccessTracking,
    trackAccess,
    trackAccessAsync,
    listIds,
    clear,
  };
}

export type AtlasCacheRegistry = ReturnType<typeof createCacheRegistry>;
