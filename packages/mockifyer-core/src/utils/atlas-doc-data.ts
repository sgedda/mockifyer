/**
 * Atlas capture snapshot + on-demand HTML render (Dev Menu / Metro).
 * Live capture stays in memory; {@link requestAtlasDocsRender} writes HTML (and flushes screenshots).
 */

import { getAtlasDocMap, type AtlasDocMap } from './atlas-doc';
import {
  getAtlasDocHtmlOutputPath,
  getAtlasHtmlNetworkEvents,
  writeAtlasDocHtml,
} from './atlas-doc-html';
import { flushAtlasScreenshotsAsync } from './atlas-screenshot';
import type { NetworkEvent } from './network-event-types';

const DEFAULT_METRO_PORT = 8081;
const ATLAS_HTML_METRO_RELATIVE_DIR = 'atlas-html';

export interface AtlasCaptureSnapshot {
  map: AtlasDocMap;
  events: NetworkEvent[];
  htmlDir?: string;
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

/** In-memory Atlas doc + recent hops for Dev Menu / Metro render. */
export function getAtlasCaptureSnapshot(scenario?: string): AtlasCaptureSnapshot {
  const map = getAtlasDocMap(scenario?.trim() || 'default');
  return {
    map,
    events: [...getAtlasHtmlNetworkEvents()],
    htmlDir: getAtlasDocHtmlOutputPath()?.trim() || undefined,
  };
}

/**
 * Render interactive Atlas HTML into `mock-data/atlas-html`.
 * On React Native, POSTs to Metro `POST /mockifyer-atlas-render`.
 * Always flushes buffered screenshots first.
 */
export async function requestAtlasDocsRender(
  options?: RequestAtlasDocsRenderOptions
): Promise<AtlasDocsRenderResult> {
  await flushAtlasScreenshotsAsync();

  const snapshot = getAtlasCaptureSnapshot(options?.scenario);
  const outputRelativeDir =
    options?.outputRelativeDir?.trim() || ATLAS_HTML_METRO_RELATIVE_DIR;

  // Node with local fs: write directly when HTML output path is configured.
  const localDir = snapshot.htmlDir?.trim();
  if (localDir) {
    const written = writeAtlasDocHtml(localDir, snapshot.map, snapshot.events);
    if (written > 0) {
      return {
        success: true,
        written,
        outputDir: localDir,
        hopCount: snapshot.events.length,
      };
    }
  }

  if (typeof fetch !== 'function') {
    return {
      success: false,
      written: 0,
      error: 'fetch unavailable and no local HTML output path',
    };
  }

  const port = resolveMetroPort(options?.metroPort);
  const url = `http://localhost:${port}/mockifyer-atlas-render`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        outputRelativeDir,
        doc: snapshot.map,
        events: snapshot.events,
      }),
    });
    const text = await res.text().catch(() => '');
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
        error: `Metro render returned non-JSON (HTTP ${res.status}): ${text.slice(0, 120)}`,
      };
    }
    if (!res.ok || !parsed.success) {
      return {
        success: false,
        written: parsed.written ?? 0,
        outputDir: parsed.dir || parsed.outputDir,
        error: parsed.error || `HTTP ${res.status}`,
      };
    }
    return {
      success: true,
      written: parsed.written ?? 0,
      outputDir: parsed.dir || parsed.outputDir,
      hopCount: parsed.hopCount ?? snapshot.events.length,
    };
  } catch (err) {
    return {
      success: false,
      written: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
