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

function tryCreateAccessStorage():
  | import('async_hooks').AsyncLocalStorage<Set<string>>
  | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AsyncLocalStorage } = require('async_hooks') as typeof import('async_hooks');
    return new AsyncLocalStorage<Set<string>>();
  } catch {
    return undefined;
  }
}

/**
 * Keyed datasource cache with access tracking for atlas attribution.
 * Use during `buildProps` / `resolveNodeData` so presentation events list only
 * datasources actually read for that CMS node.
 *
 * Nested and overlapping {@link trackAccess} / {@link trackAccessAsync} calls each
 * get their own access set (stack + AsyncLocalStorage when available) so an inner
 * or concurrent session cannot clear or end the outer one.
 */
export function createCacheRegistry(options?: AtlasCacheRegistryOptions) {
  const stores = new Map<string, AtlasCacheEntry>();
  /** Nested / manual begin–end frames (LIFO). */
  const accessStack: Set<string>[] = [];
  /** Isolates overlapping async trackAccessAsync sessions (Node). */
  const accessAls = tryCreateAccessStorage();

  function activeAccessed(): Set<string> | undefined {
    return accessAls?.getStore() ?? accessStack[accessStack.length - 1];
  }

  function removeFrame(frame: Set<string>): void {
    const index = accessStack.lastIndexOf(frame);
    if (index >= 0) {
      accessStack.splice(index, 1);
    }
  }

  function refsFromAccessed(accessed: Set<string>): AtlasDatasourceRef[] {
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
    return refs;
  }

  function set(datasourceId: string, entry: AtlasCacheEntry): void {
    stores.set(datasourceId, entry);
  }

  function getCache<T = unknown>(datasourceId: string): AtlasCacheEntry<T> | undefined {
    const accessed = activeAccessed();
    if (accessed) {
      accessed.add(datasourceId);
      options?.onAccess?.(datasourceId);
    }
    return stores.get(datasourceId) as AtlasCacheEntry<T> | undefined;
  }

  function has(datasourceId: string): boolean {
    return stores.has(datasourceId);
  }

  function clearAccessTracking(): void {
    activeAccessed()?.clear();
  }

  function beginAccessTracking(): void {
    accessStack.push(new Set());
  }

  function endAccessTracking(): AtlasDatasourceRef[] {
    const accessed = accessStack.pop();
    if (!accessed) {
      return [];
    }
    return refsFromAccessed(accessed);
  }

  /**
   * Run `fn` while tracking which caches are read; returns result + datasource refs.
   */
  function trackAccess<T>(fn: () => T): { result: T; datasources: AtlasDatasourceRef[] } {
    const frame = new Set<string>();
    const run = (): { result: T; datasources: AtlasDatasourceRef[] } => {
      accessStack.push(frame);
      try {
        const result = fn();
        return { result, datasources: refsFromAccessed(frame) };
      } finally {
        removeFrame(frame);
      }
    };
    if (accessAls) {
      return accessAls.run(frame, run);
    }
    return run();
  }

  async function trackAccessAsync<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; datasources: AtlasDatasourceRef[] }> {
    const frame = new Set<string>();
    const run = async (): Promise<{ result: T; datasources: AtlasDatasourceRef[] }> => {
      accessStack.push(frame);
      try {
        const result = await fn();
        return { result, datasources: refsFromAccessed(frame) };
      } finally {
        removeFrame(frame);
      }
    };
    if (accessAls) {
      return accessAls.run(frame, run);
    }
    return run();
  }

  function listIds(): string[] {
    return [...stores.keys()];
  }

  function clear(): void {
    stores.clear();
    accessStack.length = 0;
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
