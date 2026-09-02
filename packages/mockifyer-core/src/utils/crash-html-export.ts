/**
 * Write crash-scoped Atlas HTML traces locally (Node fs or Metro POST on React Native).
 */

import type { AtlasDocMap } from './atlas-doc';
import { getAtlasDocMap } from './atlas-doc';
import {
  buildCrashIncidentHtml,
  getAtlasDocHtmlOutputPath,
  writeCrashIncidentHtmlFile,
} from './atlas-doc-html';
import type { NetworkEvent } from './network-event-types';

const DEFAULT_MOCK_DATA_PATH = 'mock-data';
const DEFAULT_METRO_PORT = 8081;
const METRO_EXPORT_TIMEOUT_MS = 2_500;

export interface LocalCrashTraceLinks {
  /** Relative path under mock-data for VS Code / Finder. */
  relativePath: string;
  /** Absolute path when known (Metro POST or Node write). */
  filePath?: string;
  /** file:// URL on Node or when Metro returns an absolute path. */
  fileUrl?: string;
  /** Metro-served URL — open in simulator browser during dev. */
  browseUrl?: string;
}

export interface ExportCrashContextHtmlOptions {
  crashContext: {
    incident: NetworkEvent;
    hops: NetworkEvent[];
    suspects: Array<{ method: string; url: string; summary: string }>;
  };
  incidentId: string;
  errorMessage: string;
  mockDataPath?: string;
  metroPort?: number;
  /** Optional atlas CMS map; defaults to in-process {@link getAtlasDocMap}. */
  atlasMap?: AtlasDocMap;
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

function buildRelativeIncidentPath(mockDataPath: string, incidentId: string): string {
  return `${mockDataPath.replace(/[/\\]+$/, '')}/atlas-html/incidents/${incidentId}.html`;
}

function buildSuspectSummaries(crashContext: ExportCrashContextHtmlOptions['crashContext']): string[] {
  return crashContext.suspects.map((s) => `${s.method} ${s.url} — ${s.summary}`);
}

/**
 * Build interactive crash HTML and persist under `mock-data/atlas-html/incidents/{id}.html`.
 * On React Native, POSTs to Metro `/mockifyer-atlas-html` (dev machine write + serve).
 */
export async function exportCrashContextHtmlLocal(
  options: ExportCrashContextHtmlOptions
): Promise<LocalCrashTraceLinks | null> {
  const mockDataPath = options.mockDataPath?.trim() || DEFAULT_MOCK_DATA_PATH;
  const scenario = options.crashContext.incident.scenario?.trim() || 'default';
  const atlasMap = options.atlasMap ?? getAtlasDocMap(scenario);
  const html = buildCrashIncidentHtml(atlasMap, {
    incident: options.crashContext.incident,
    hops: options.crashContext.hops,
    suspectSummaries: buildSuspectSummaries(options.crashContext),
    errorMessage: options.errorMessage,
    incidentId: options.incidentId,
  });

  const relativePath = buildRelativeIncidentPath(mockDataPath, options.incidentId);
  const htmlRoot =
    getAtlasDocHtmlOutputPath()?.trim() || `${mockDataPath.replace(/[/\\]+$/, '')}/atlas-html`;
  const nodeFilePath = writeCrashIncidentHtmlFile(htmlRoot, options.incidentId, html);
  if (nodeFilePath) {
    return {
      relativePath,
      filePath: nodeFilePath,
      fileUrl: `file://${nodeFilePath}`,
    };
  }

  if (typeof fetch !== 'function') {
    return null;
  }

  const metroPort = resolveMetroPort(options.metroPort);
  const browseUrl = `http://localhost:${metroPort}/mockifyer-atlas-html/incidents/${options.incidentId}.html`;

  try {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timeout = controller
      ? setTimeout(() => controller.abort(), METRO_EXPORT_TIMEOUT_MS)
      : undefined;
    const res = await fetch(`http://localhost:${metroPort}/mockifyer-atlas-html`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ incidentId: options.incidentId, html }),
      signal: controller?.signal,
    });
    if (timeout) clearTimeout(timeout);
    if (!res.ok) {
      return { relativePath, browseUrl };
    }
    const body = (await res.json()) as {
      filePath?: string;
      relativePath?: string;
    };
    const filePath = body.filePath?.trim();
    return {
      relativePath: body.relativePath?.trim() || relativePath,
      filePath,
      fileUrl: filePath ? `file://${filePath}` : undefined,
      browseUrl,
    };
  } catch {
    return { relativePath, browseUrl };
  }
}
