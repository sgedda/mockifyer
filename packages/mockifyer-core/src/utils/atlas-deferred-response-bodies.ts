/**
 * Response bodies the app holds (unserialized) during an Atlas `t` capture and
 * uploads to Metro after the capture stops, so hop events stay small while the app runs.
 */
import { logger } from './logger';
import {
  joinMetroResponseBodyPatchesUrl,
  type NetworkEventResponseBodyPatch,
} from './metro-network-stream';
import { resolveUnpatchedFetch } from './unpatched-global-fetch';

/** Most recent responses kept per capture; older ones are dropped. */
export const ATLAS_DEFERRED_RESPONSE_BODIES_MAX = 500;
/** Bodies converted per idle slice before handing the JS thread back to the UI. */
export const ATLAS_DEFERRED_RESPONSE_BODIES_PER_SLICE = 5;
/** Upper bound on waiting for an idle frame, so a busy app still finishes the upload. */
const IDLE_WAIT_TIMEOUT_MS = 500;

export interface DeferredResponseBody {
  /** Hop `id` the event was emitted with. */
  id: string;
  requestId?: string;
  /** Raw response body as the app received it. */
  body: unknown;
}

export type DeferredResponseBodyToPatch = (
  entry: DeferredResponseBody
) => NetworkEventResponseBodyPatch | undefined;

interface DeferredResponseBodiesState {
  pending: Map<string, DeferredResponseBody>;
  flush?: Promise<void>;
}

const DEFERRED_RESPONSE_BODIES_GLOBAL = Symbol.for(
  '@sgedda/mockifyer-core.atlasDeferredResponseBodies'
);

function getState(): DeferredResponseBodiesState {
  const globalStore = globalThis as typeof globalThis & {
    [DEFERRED_RESPONSE_BODIES_GLOBAL]?: DeferredResponseBodiesState;
  };
  globalStore[DEFERRED_RESPONSE_BODIES_GLOBAL] ??= { pending: new Map() };
  return globalStore[DEFERRED_RESPONSE_BODIES_GLOBAL];
}

/** Keep a response body for upload when the capture stops (drops the oldest past the cap). */
export function deferAtlasResponseBody(entry: DeferredResponseBody): void {
  if (entry.body === undefined) return;
  const { pending } = getState();
  pending.delete(entry.id);
  pending.set(entry.id, entry);
  if (pending.size > ATLAS_DEFERRED_RESPONSE_BODIES_MAX) {
    const oldest = pending.keys().next().value;
    if (oldest !== undefined) pending.delete(oldest);
  }
}

export function deferredAtlasResponseBodyCount(): number {
  return getState().pending.size;
}

/** Drop held bodies (new capture started, or tests). */
export function clearDeferredAtlasResponseBodies(): void {
  getState().pending.clear();
}

function waitForIdle(): Promise<void> {
  return new Promise((resolve) => {
    const requestIdle = (
      globalThis as {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => unknown;
      }
    ).requestIdleCallback;
    if (typeof requestIdle === 'function') {
      requestIdle(() => resolve(), { timeout: IDLE_WAIT_TIMEOUT_MS });
      return;
    }
    setTimeout(resolve, 0);
  });
}

function toPatchSafely(
  toPatch: DeferredResponseBodyToPatch,
  entry: DeferredResponseBody
): NetworkEventResponseBodyPatch | undefined {
  try {
    return toPatch(entry);
  } catch (error) {
    logger.debug(`[Mockifyer] Atlas: could not serialize response body for hop ${entry.id}:`, error);
    return undefined;
  }
}

async function postPatches(
  fetchFn: typeof fetch,
  url: string,
  patches: NetworkEventResponseBodyPatch[]
): Promise<void> {
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ patches }),
    });
    if (!res.ok) {
      logger.warn(`[Mockifyer] Atlas: Metro rejected response bodies (HTTP ${res.status})`);
    }
  } catch (error) {
    logger.warn('[Mockifyer] Atlas: failed to upload response bodies to Metro:', error);
  }
}

/**
 * Convert and upload held bodies a slice at a time while the app is idle.
 * Concurrent calls share one flush; bodies held during a flush go out with the next one.
 */
export function flushDeferredAtlasResponseBodies(options: {
  metroBaseUrl: string;
  toPatch: DeferredResponseBodyToPatch;
}): Promise<void> {
  const state = getState();
  if (state.flush) return state.flush;

  const entries = [...state.pending.values()];
  state.pending.clear();
  if (entries.length === 0) return Promise.resolve();

  const fetchFn = resolveUnpatchedFetch();
  if (!fetchFn) {
    logger.warn(`[Mockifyer] Atlas: no fetch available — dropped ${entries.length} response bod(ies)`);
    return Promise.resolve();
  }
  const url = joinMetroResponseBodyPatchesUrl(options.metroBaseUrl);

  const flush = (async (): Promise<void> => {
    try {
      for (let start = 0; start < entries.length; start += ATLAS_DEFERRED_RESPONSE_BODIES_PER_SLICE) {
        await waitForIdle();
        const patches = entries
          .slice(start, start + ATLAS_DEFERRED_RESPONSE_BODIES_PER_SLICE)
          .map((entry) => toPatchSafely(options.toPatch, entry))
          .filter((patch): patch is NetworkEventResponseBodyPatch => patch != null);
        if (patches.length > 0) {
          await postPatches(fetchFn, url, patches);
        }
      }
      logger.info(`[Mockifyer] Atlas: uploaded ${entries.length} response bod(ies) after capture stopped`);
    } finally {
      state.flush = undefined;
    }
  })();
  state.flush = flush;
  return flush;
}
