import type { PoolResponseItem } from '../../types/fixture-pool';
import { loadPoolResponseItem, type FixturePoolFsAdapter } from './fs-store';
import type { LoadPoolResponseFn } from './resolve-pool-refs';
import { isPoolRefNode } from './resolve-pool-refs';

/** Minimal sync filesystem surface used to load promoted pool responses at serve time. */
export interface NodeLikePoolFs {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf8') => string;
}

export interface CreateServeTimePoolResponseLoaderOptions {
  mockDataPath: string;
  /**
   * Node `fs` (or compatible). Metro empty stubs (`{}`) must be omitted — use
   * {@link isUsableNodeLikePoolFs} before passing.
   */
  nodeFs?: NodeLikePoolFs | null;
  /** Node `path.join` when available; falls back to POSIX-style join. */
  joinPath?: ((...parts: string[]) => string) | null;
  /**
   * Optional cache for environments without Node fs (e.g. React Native hybrid/expo).
   * Checked after disk load fails or when disk is unavailable.
   */
  cache?: Map<string, PoolResponseItem>;
}

function posixJoinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
}

/**
 * True when `fs` exposes the sync methods needed by {@link loadPoolResponseItem}.
 * Rejects Metro empty-module stubs (`{}`).
 */
export function isUsableNodeLikePoolFs(fs: unknown): fs is NodeLikePoolFs {
  if (!fs || typeof fs !== 'object') return false;
  const candidate = fs as Partial<NodeLikePoolFs>;
  return (
    typeof candidate.existsSync === 'function' && typeof candidate.readFileSync === 'function'
  );
}

/**
 * Collect `$pool.id` values from mock response data (deep walk).
 */
export function collectPoolRefIds(data: unknown, out: Set<string> = new Set()): Set<string> {
  if (isPoolRefNode(data)) {
    const id = data.$pool.id;
    if (typeof id === 'string' && id.trim()) {
      out.add(id.trim());
    }
    return out;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      collectPoolRefIds(item, out);
    }
    return out;
  }
  if (data !== null && typeof data === 'object') {
    for (const value of Object.values(data as Record<string, unknown>)) {
      collectPoolRefIds(value, out);
    }
  }
  return out;
}

/**
 * Build a serve-time `$pool` loader that reads from Node fs when available,
 * otherwise (or on miss) from an optional in-memory cache.
 *
 * Always returns a function so callers can pass `loadPoolResponse` even when
 * `fs`/`path` are unavailable (React Native) — avoiding PoolRefResolveError
 * from a missing loader.
 */
export function createServeTimePoolResponseLoader(
  options: CreateServeTimePoolResponseLoaderOptions
): LoadPoolResponseFn {
  const { mockDataPath, cache } = options;
  const nodeFs = isUsableNodeLikePoolFs(options.nodeFs) ? options.nodeFs : null;
  const joinPath =
    typeof options.joinPath === 'function' ? options.joinPath : posixJoinPath;

  let adapter: FixturePoolFsAdapter | null = null;
  if (nodeFs) {
    adapter = {
      joinPath,
      existsSync: (p) => nodeFs.existsSync(p),
      readFileSync: (p, encoding) => nodeFs.readFileSync(p, encoding),
      writeFileSync: () => {
        throw new Error('pool loader is read-only');
      },
      mkdirSync: () => undefined,
    };
  }

  return (id) => {
    if (adapter) {
      const fromDisk = loadPoolResponseItem(mockDataPath, id, adapter);
      if (fromDisk) {
        return fromDisk;
      }
    }
    return cache?.get(id);
  };
}
