/**
 * Atlas capture snapshot + on-demand HTML/HAR render (Dev Menu / Metro).
 * Live capture stays in memory; {@link requestAtlasDocsRender} writes HTML + `atlas.har`
 * (and flushes screenshots). Oversized hop bodies spill async to `atlas-html/bodies/`.
 */

import { getAtlasRuntimeScenario } from './atlas';
import {
  atlasDocContentScore,
  getAtlasDocMap,
  listAtlasDocScenarios,
  mergeAtlasDocScreenshotRefs,
  peekAtlasDocMap,
  type AtlasDocMap,
} from './atlas-doc';
import {
  getAtlasDocHtmlOutputPath,
  getAtlasHtmlNetworkEvents,
  writeAtlasDocHtml,
} from './atlas-doc-html';
import { flushAtlasScreenshotsAsync } from './atlas-screenshot';
import {
  flushNetworkBodySpillsToDir,
  getNetworkBodySpillSnapshot,
} from './network-body-spill';
import type { NetworkEvent } from './network-event-types';
import { getCurrentScenario } from './scenario';
import { resolveUnpatchedFetch } from './unpatched-global-fetch';
import { utf8ByteLength } from './crypto-digest';

const DEFAULT_METRO_PORT = 8081;
const ATLAS_HTML_METRO_RELATIVE_DIR = 'atlas-html';
/** Hard deadline so Dev Menu never stays on "rendering atlas…" forever. */
const ATLAS_RENDER_OVERALL_TIMEOUT_MS = 90_000;
/** Cap screenshot flush so a large buffer cannot block render indefinitely. */
const ATLAS_FLUSH_SCREENSHOTS_BUDGET_MS = 55_000;
/** Dev Menu → Metro render can be large; abort fetch instead of hanging forever. */
const ATLAS_METRO_RENDER_TIMEOUT_MS = 60_000;
/** Soft cap on bodySpills in the Metro POST (spills may already be on disk). */
const MAX_METRO_BODY_SPILL_BYTES = 2_000_000;
const SLIM_PREVIEW_CHARS = 4_096;

export interface AtlasCaptureSnapshot {
  map: AtlasDocMap;
  events: NetworkEvent[];
  htmlDir?: string;
  /** Scenario key used for {@link AtlasCaptureSnapshot.map}. */
  scenario: string;
}

export interface RequestAtlasDocsRenderOptions {
  scenario?: string;
  metroPort?: number;
  /** Relative dir under mock-data (Metro). Default `atlas-html`. */
  outputRelativeDir?: string;
  persistData?: boolean;
}

export interface AtlasDocsRenderResult {
  success: boolean;
  written: number;
  outputDir?: string;
  hopCount?: number;
  error?: string;
}

function resolveMetroPort(explicit?: number): number {
  if (explicit != null && Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  if (typeof process !== 'undefined') {
    const fromEnv = process.env.METRO_PORT?.trim();
    if (fromEnv) {
      const n = Number.parseInt(fromEnv, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return DEFAULT_METRO_PORT;
}

/**
 * Resolve which in-memory Atlas doc map to render.
 * Prefer explicit → atlas runtime → {@link getCurrentScenario} → richest non-empty map.
 * Avoids hardcoding `default` after unset traffic moved to `_scratch`.
 */
export function resolveAtlasRenderScenario(explicit?: string): string {
  const preferred = explicit?.trim();
  if (preferred) return preferred;

  const candidates: string[] = [];
  const runtime = getAtlasRuntimeScenario()?.trim();
  if (runtime) candidates.push(runtime);
  try {
    const current = getCurrentScenario()?.trim();
    if (current && !candidates.includes(current)) candidates.push(current);
  } catch {
    // getCurrentScenario may touch fs in odd environments — ignore
  }

  for (const key of candidates) {
    const existing = peekAtlasDocMap(key);
    if (existing && atlasDocContentScore(existing) > 0) return key;
  }

  let bestKey = candidates[0] || 'default';
  let bestScore = -1;
  for (const key of listAtlasDocScenarios()) {
    const map = peekAtlasDocMap(key);
    if (!map) continue;
    const score = atlasDocContentScore(map);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  if (bestScore > 0) return bestKey;
  return candidates[0] || 'default';
}

/** In-memory Atlas doc + recent hops for Dev Menu / Metro render. */
export function getAtlasCaptureSnapshot(scenario?: string): AtlasCaptureSnapshot {
  const resolved = resolveAtlasRenderScenario(scenario);
  const map = getAtlasDocMap(resolved);
  const donors = listAtlasDocScenarios()
    .filter((key) => key !== resolved)
    .map((key) => peekAtlasDocMap(key))
    .filter((m): m is AtlasDocMap => m != null);
  const mapWithScreenshots =
    donors.length > 0 ? mergeAtlasDocScreenshotRefs(map, donors) : map;
  return {
    map: mapWithScreenshots,
    scenario: resolved,
    events: [...getAtlasHtmlNetworkEvents()],
    htmlDir: getAtlasDocHtmlOutputPath()?.trim() || undefined,
  };
}

function slimPreview(value: string | undefined, maxChars: number): string | undefined {
  if (value == null || value === '') return value;
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}…`;
}

/** Shrink hop JSON for Metro POST — full bodies travel via bodySpills / disk refs. */
function slimEventsForMetroRender(events: readonly NetworkEvent[]): NetworkEvent[] {
  return events.map((event) => {
    const next: NetworkEvent = { ...event };
    if (next.requestBodyRef) {
      next.requestBodyPreview = slimPreview(next.requestBodyPreview, 512);
    } else {
      next.requestBodyPreview = slimPreview(next.requestBodyPreview, SLIM_PREVIEW_CHARS);
    }
    if (next.responseBodyRef) {
      next.responseBodyPreview = slimPreview(next.responseBodyPreview, 512);
    } else {
      next.responseBodyPreview = slimPreview(next.responseBodyPreview, SLIM_PREVIEW_CHARS);
    }
    return next;
  });
}

/** Prefer settling with a result over leaving Dev Menu spinners forever. */
function settleWithin<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: () => T,
  onReject?: (err: unknown) => T
): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(onTimeout());
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(onReject ? onReject(err) : onTimeout());
      }
    );
  });
}

function capBodySpillsForMetro(
  spills: Record<string, string>,
  maxBytes: number
): Record<string, string> {
  const out: Record<string, string> = {};
  let used = 0;
  for (const [key, text] of Object.entries(spills)) {
    if (typeof text !== 'string') continue;
    const n = utf8ByteLength(text) + key.length;
    if (used + n > maxBytes) break;
    out[key] = text;
    used += n;
  }
  return out;
}

async function requestAtlasDocsRenderInner(
  options?: RequestAtlasDocsRenderOptions
): Promise<AtlasDocsRenderResult> {
  await settleWithin(
    flushAtlasScreenshotsAsync(),
    ATLAS_FLUSH_SCREENSHOTS_BUDGET_MS,
    () => ({ flushed: 0, failed: 0 })
  );

  const snapshot = getAtlasCaptureSnapshot(options?.scenario);
  const bodySpills = capBodySpillsForMetro(
    getNetworkBodySpillSnapshot(),
    MAX_METRO_BODY_SPILL_BYTES
  );
  const outputRelativeDir =
    options?.outputRelativeDir?.trim() || ATLAS_HTML_METRO_RELATIVE_DIR;

  // Node with local fs: write directly when HTML output path is configured.
  const localDir = snapshot.htmlDir?.trim();
  if (localDir) {
    flushNetworkBodySpillsToDir(localDir);
    const written = writeAtlasDocHtml(localDir, snapshot.map, snapshot.events);
    if (written > 0) {
      return {
        success: true,
        written,
        outputDir: localDir,
        hopCount: snapshot.events.length,
      };
    }
    // RN sets htmlDir but has no fs — fall through to Metro.
  }

  const fetchFn = resolveUnpatchedFetch();
  if (!fetchFn) {
    return {
      success: false,
      written: 0,
      error: 'fetch unavailable and no local HTML output path',
    };
  }

  const port = resolveMetroPort(options?.metroPort);
  const url = `http://localhost:${port}/mockifyer-atlas-render`;
  const slimEvents = slimEventsForMetroRender(snapshot.events);

  let bodyJson: string;
  try {
    bodyJson = JSON.stringify({
      outputRelativeDir,
      doc: snapshot.map,
      events: slimEvents,
      bodySpills,
    });
  } catch (err) {
    return {
      success: false,
      written: 0,
      error:
        err instanceof Error
          ? `Failed to serialize Atlas render payload: ${err.message}`
          : 'Failed to serialize Atlas render payload',
    };
  }

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timeout = controller
      ? setTimeout(() => controller.abort(), ATLAS_METRO_RENDER_TIMEOUT_MS)
      : undefined;
    const fetchPromise = fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: bodyJson,
      signal: controller?.signal,
    });
    type FetchOutcome =
      | { kind: 'ok'; r: Response }
      | { kind: 'err'; err: unknown }
      | { kind: 'timeout' };
    // Always race a timer so environments without AbortController still settle.
    const res = await settleWithin<FetchOutcome>(
      fetchPromise.then(
        (r): FetchOutcome => ({ kind: 'ok', r }),
        (err: unknown): FetchOutcome => ({ kind: 'err', err })
      ),
      ATLAS_METRO_RENDER_TIMEOUT_MS,
      () => ({ kind: 'timeout' })
    );
    if (timeout) clearTimeout(timeout);

    if (res.kind === 'timeout') {
      try {
        controller?.abort();
      } catch {
        /* ignore */
      }
      return {
        success: false,
        written: 0,
        error: `Metro atlas render timed out after ${ATLAS_METRO_RENDER_TIMEOUT_MS}ms`,
      };
    }
    if (res.kind === 'err') {
      const err = res.err;
      const aborted =
        err instanceof Error &&
        (err.name === 'AbortError' || /aborted/i.test(err.message));
      return {
        success: false,
        written: 0,
        error: aborted
          ? `Metro atlas render timed out after ${ATLAS_METRO_RENDER_TIMEOUT_MS}ms`
          : err instanceof Error
            ? err.message
            : String(err),
      };
    }

    const httpRes = res.r;
    const text = await httpRes.text().catch(() => '');
    let parsed: {
      success?: boolean;
      written?: number;
      dir?: string;
      outputDir?: string;
      hopCount?: number;
      error?: string;
    };
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      return {
        success: false,
        written: 0,
        error: `Metro render returned non-JSON (HTTP ${httpRes.status}): ${text.slice(0, 120)}`,
      };
    }
    if (!httpRes.ok || !parsed.success) {
      return {
        success: false,
        written: parsed.written ?? 0,
        outputDir: parsed.dir || parsed.outputDir,
        error: parsed.error || `HTTP ${httpRes.status}`,
      };
    }
    return {
      success: true,
      written: parsed.written ?? 0,
      outputDir: parsed.dir || parsed.outputDir,
      hopCount: parsed.hopCount ?? snapshot.events.length,
    };
  } catch (err) {
    const aborted =
      err instanceof Error &&
      (err.name === 'AbortError' || /aborted/i.test(err.message));
    return {
      success: false,
      written: 0,
      error: aborted
        ? `Metro atlas render timed out after ${ATLAS_METRO_RENDER_TIMEOUT_MS}ms`
        : err instanceof Error
          ? err.message
          : String(err),
    };
  }
}

/**
 * Render interactive Atlas HTML (+ `atlas.har`, `atlas-events.json`) into `mock-data/atlas-html`.
 * On React Native, POSTs to Metro `POST /mockifyer-atlas-render`.
 * Always flushes buffered screenshots first (budgeted).
 * Always settles within {@link ATLAS_RENDER_OVERALL_TIMEOUT_MS} so Dev Menu UI can clear.
 */
export async function requestAtlasDocsRender(
  options?: RequestAtlasDocsRenderOptions
): Promise<AtlasDocsRenderResult> {
  return settleWithin(
    requestAtlasDocsRenderInner(options),
    ATLAS_RENDER_OVERALL_TIMEOUT_MS,
    () => ({
      success: false,
      written: 0,
      error: `Atlas render timed out after ${ATLAS_RENDER_OVERALL_TIMEOUT_MS}ms`,
    }),
    (err) => ({
      success: false,
      written: 0,
      error: err instanceof Error ? err.message : String(err),
    })
  );
}
