/**
 * Read Atlas HTML generate output under mock-data/atlas-html for MCP / API.
 * Bodies come from bodies-search.json and optional bodies/* spill files —
 * only present when captureBodies/spill ran at emit or generate hydrated them.
 */

import * as fs from 'fs';
import * as path from 'path';

export const ATLAS_HTML_DIR_NAME = 'atlas-html';

const GENERATED_FILES = [
  'index.html',
  'atlas.har',
  'atlas-events.json',
  'bodies-search.json',
] as const;

export type AtlasGeneratedFileName = (typeof GENERATED_FILES)[number];

export interface AtlasGeneratedFileInfo {
  name: AtlasGeneratedFileName;
  exists: boolean;
  sizeBytes?: number;
  modified?: string;
}

export interface AtlasGeneratedStatus {
  exists: boolean;
  atlasHtmlPath: string;
  htmlUrlPath: string;
  files: AtlasGeneratedFileInfo[];
  hopCount: number | null;
  bodySearchEntryCount: number | null;
  bodySpillFileCount: number | null;
  message?: string;
}

export interface AtlasGeneratedHopSummary {
  id: string;
  timestamp?: string;
  method?: string;
  url?: string;
  status?: number;
  source?: string;
  requestId?: string | null;
  parentRequestId?: string | null;
  clientId?: string | null;
  sessionId?: string | null;
  hasBodySearchText: boolean;
  requestBodyRef?: string;
  responseBodyRef?: string;
  usageScreens?: string[];
}

export interface AtlasBodySearchHit {
  eventId: string;
  matchCount: number;
  snippet: string;
  hop?: AtlasGeneratedHopSummary;
}

function atlasHtmlDir(mockDataPath: string): string {
  return path.join(mockDataPath, ATLAS_HTML_DIR_NAME);
}

function safeStat(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function fileInfo(dir: string, name: AtlasGeneratedFileName): AtlasGeneratedFileInfo {
  const st = safeStat(path.join(dir, name));
  if (!st?.isFile()) {
    return { name, exists: false };
  }
  return {
    name,
    exists: true,
    sizeBytes: st.size,
    modified: st.mtime.toISOString(),
  };
}

function countBodySpillFiles(dir: string): number | null {
  const bodiesDir = path.join(dir, 'bodies');
  const st = safeStat(bodiesDir);
  if (!st?.isDirectory()) return 0;
  try {
    return fs.readdirSync(bodiesDir).filter((n) => {
      const p = path.join(bodiesDir, n);
      return safeStat(p)?.isFile();
    }).length;
  } catch {
    return null;
  }
}

function usageScreensFromHop(hop: Record<string, unknown>): string[] | undefined {
  const usage = hop.usage;
  if (!usage) return undefined;
  const list = Array.isArray(usage) ? usage : [usage];
  const screens = list
    .map((u) =>
      u && typeof u === 'object' && typeof (u as { screen?: unknown }).screen === 'string'
        ? (u as { screen: string }).screen.trim()
        : ''
    )
    .filter(Boolean);
  return screens.length ? [...new Set(screens)] : undefined;
}

function summarizeHop(
  hop: Record<string, unknown>,
  bodySearchIds: Set<string>
): AtlasGeneratedHopSummary | null {
  const id = typeof hop.id === 'string' ? hop.id.trim() : '';
  if (!id) return null;
  return {
    id,
    timestamp: typeof hop.timestamp === 'string' ? hop.timestamp : undefined,
    method: typeof hop.method === 'string' ? hop.method : undefined,
    url: typeof hop.url === 'string' ? hop.url : undefined,
    status: typeof hop.status === 'number' ? hop.status : undefined,
    source: typeof hop.source === 'string' ? hop.source : undefined,
    requestId: typeof hop.requestId === 'string' ? hop.requestId : hop.requestId === null ? null : undefined,
    parentRequestId:
      typeof hop.parentRequestId === 'string'
        ? hop.parentRequestId
        : hop.parentRequestId === null
          ? null
          : undefined,
    clientId: typeof hop.clientId === 'string' ? hop.clientId : hop.clientId === null ? null : undefined,
    sessionId:
      typeof hop.sessionId === 'string' ? hop.sessionId : hop.sessionId === null ? null : undefined,
    hasBodySearchText: bodySearchIds.has(id),
    requestBodyRef: typeof hop.requestBodyRef === 'string' ? hop.requestBodyRef : undefined,
    responseBodyRef: typeof hop.responseBodyRef === 'string' ? hop.responseBodyRef : undefined,
    usageScreens: usageScreensFromHop(hop),
  };
}

function loadBodySearchCorpus(dir: string): Record<string, string> {
  const data = readJsonFile<Record<string, unknown>>(path.join(dir, 'bodies-search.json'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.length > 0) {
      out[id] = value;
    }
  }
  return out;
}

function loadGeneratedEvents(dir: string): Record<string, unknown>[] {
  const data = readJsonFile<unknown>(path.join(dir, 'atlas-events.json'));
  if (!Array.isArray(data)) return [];
  return data.filter((e): e is Record<string, unknown> => !!e && typeof e === 'object');
}

function snippetAroundMatch(text: string, query: string, radius = 120): string {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) {
    return text.length <= radius * 2 ? text : `${text.slice(0, radius * 2)}…`;
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + q.length + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

/**
 * Resolve a relative path under atlas-html (e.g. bodies/x-res.json) with traversal guards.
 */
export function resolveAtlasHtmlRelativePath(
  mockDataPath: string,
  relativePath: string
): string | null {
  const trimmed = relativePath.trim().replace(/^\/+/, '');
  if (!trimmed || trimmed.includes('\0')) return null;
  const root = path.resolve(atlasHtmlDir(mockDataPath));
  const abs = path.resolve(root, trimmed);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    return null;
  }
  return abs;
}

export function getAtlasGeneratedStatus(mockDataPath: string): AtlasGeneratedStatus {
  const dir = atlasHtmlDir(mockDataPath);
  const htmlUrlPath = '/atlas-html/';
  const rootStat = safeStat(dir);
  if (!rootStat?.isDirectory()) {
    return {
      exists: false,
      atlasHtmlPath: dir,
      htmlUrlPath,
      files: GENERATED_FILES.map((name) => ({ name, exists: false })),
      hopCount: null,
      bodySearchEntryCount: null,
      bodySpillFileCount: null,
      message:
        'Atlas HTML not generated yet. Run Atlas docs render / mockifyer-atlas render after capturing traffic.',
    };
  }

  const files = GENERATED_FILES.map((name) => fileInfo(dir, name));
  const corpus = loadBodySearchCorpus(dir);
  const events = loadGeneratedEvents(dir);
  const bodySearchEntryCount = Object.keys(corpus).length;
  const hopCount = events.length > 0 ? events.length : bodySearchEntryCount || null;

  return {
    exists: true,
    atlasHtmlPath: dir,
    htmlUrlPath,
    files,
    hopCount,
    bodySearchEntryCount,
    bodySpillFileCount: countBodySpillFiles(dir),
  };
}

export function listAtlasGeneratedHops(
  mockDataPath: string,
  options?: { limit?: number; onlyWithBodies?: boolean }
): {
  exists: boolean;
  hopCount: number;
  hops: AtlasGeneratedHopSummary[];
  message?: string;
} {
  const status = getAtlasGeneratedStatus(mockDataPath);
  if (!status.exists) {
    return { exists: false, hopCount: 0, hops: [], message: status.message };
  }

  const dir = atlasHtmlDir(mockDataPath);
  const corpus = loadBodySearchCorpus(dir);
  const bodyIds = new Set(Object.keys(corpus));
  const events = loadGeneratedEvents(dir);
  const limit = Math.min(Math.max(options?.limit ?? 200, 1), 5000);

  let hops = events
    .map((e) => summarizeHop(e, bodyIds))
    .filter((h): h is AtlasGeneratedHopSummary => h != null);

  if (hops.length === 0 && bodyIds.size > 0) {
    hops = [...bodyIds].map((id) => ({
      id,
      hasBodySearchText: true,
    }));
  }

  if (options?.onlyWithBodies) {
    hops = hops.filter((h) => h.hasBodySearchText);
  }

  return {
    exists: true,
    hopCount: hops.length,
    hops: hops.slice(0, limit),
  };
}

export function searchAtlasGeneratedBodies(
  mockDataPath: string,
  query: string,
  options?: { limit?: number; includeHop?: boolean }
): {
  exists: boolean;
  query: string;
  matchCount: number;
  hits: AtlasBodySearchHit[];
  message?: string;
} {
  const q = query.trim();
  if (!q) {
    return { exists: true, query: '', matchCount: 0, hits: [], message: 'query is required' };
  }

  const status = getAtlasGeneratedStatus(mockDataPath);
  if (!status.exists) {
    return { exists: false, query: q, matchCount: 0, hits: [], message: status.message };
  }

  const dir = atlasHtmlDir(mockDataPath);
  const corpus = loadBodySearchCorpus(dir);
  if (Object.keys(corpus).length === 0) {
    return {
      exists: true,
      query: q,
      matchCount: 0,
      hits: [],
      message:
        'bodies-search.json is empty or missing. Enable networkLog.captureBodies (or Atlas body spill) before generate, or use mockifyer_get_mock for recorded responses.',
    };
  }

  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100);
  const qLower = q.toLowerCase();
  const hits: AtlasBodySearchHit[] = [];

  for (const [eventId, text] of Object.entries(corpus)) {
    const lower = text.toLowerCase();
    let matchCount = 0;
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(qLower, from);
      if (idx < 0) break;
      matchCount += 1;
      from = idx + qLower.length;
      if (matchCount > 50) break;
    }
    if (matchCount === 0) continue;
    hits.push({
      eventId,
      matchCount,
      snippet: snippetAroundMatch(text, q),
    });
  }

  hits.sort((a, b) => b.matchCount - a.matchCount || a.eventId.localeCompare(b.eventId));
  const limited = hits.slice(0, limit);

  if (options?.includeHop !== false) {
    const events = loadGeneratedEvents(dir);
    const byId = new Map<string, Record<string, unknown>>();
    for (const e of events) {
      if (typeof e.id === 'string') byId.set(e.id, e);
    }
    const bodyIds = new Set(Object.keys(corpus));
    for (const hit of limited) {
      const hop = byId.get(hit.eventId);
      if (hop) {
        hit.hop = summarizeHop(hop, bodyIds) ?? undefined;
      }
    }
  }

  return {
    exists: true,
    query: q,
    matchCount: hits.length,
    hits: limited,
  };
}

export function getAtlasGeneratedHopBody(
  mockDataPath: string,
  eventId: string,
  options?: { maxChars?: number }
): {
  exists: boolean;
  eventId: string;
  found: boolean;
  truncated: boolean;
  bodyText?: string;
  hop?: AtlasGeneratedHopSummary;
  spill?: { request?: string; response?: string };
  message?: string;
} {
  const id = eventId.trim();
  if (!id) {
    return { exists: true, eventId: '', found: false, truncated: false, message: 'eventId is required' };
  }

  const status = getAtlasGeneratedStatus(mockDataPath);
  if (!status.exists) {
    return {
      exists: false,
      eventId: id,
      found: false,
      truncated: false,
      message: status.message,
    };
  }

  const dir = atlasHtmlDir(mockDataPath);
  const corpus = loadBodySearchCorpus(dir);
  const events = loadGeneratedEvents(dir);
  const hopRaw = events.find((e) => e.id === id);
  const bodyIds = new Set(Object.keys(corpus));
  const hop = hopRaw ? summarizeHop(hopRaw, bodyIds) ?? undefined : undefined;

  let bodyText = corpus[id];
  const spill: { request?: string; response?: string } = {};

  if (hopRaw) {
    const reqRef = typeof hopRaw.requestBodyRef === 'string' ? hopRaw.requestBodyRef : undefined;
    const resRef = typeof hopRaw.responseBodyRef === 'string' ? hopRaw.responseBodyRef : undefined;
    if (reqRef) {
      const abs = resolveAtlasHtmlRelativePath(mockDataPath, reqRef);
      if (abs && safeStat(abs)?.isFile()) {
        try {
          spill.request = fs.readFileSync(abs, 'utf8');
        } catch {
          // ignore
        }
      }
    }
    if (resRef) {
      const abs = resolveAtlasHtmlRelativePath(mockDataPath, resRef);
      if (abs && safeStat(abs)?.isFile()) {
        try {
          spill.response = fs.readFileSync(abs, 'utf8');
        } catch {
          // ignore
        }
      }
    }
  }

  if (!bodyText) {
    const parts = [spill.request, spill.response].filter(Boolean);
    if (parts.length) bodyText = parts.join('\n');
  }

  if (!bodyText) {
    return {
      exists: true,
      eventId: id,
      found: false,
      truncated: false,
      hop,
      spill: Object.keys(spill).length ? spill : undefined,
      message:
        'No generated body text for this hop. Prefer mockifyer_get_mock when source is mock-hit, or re-generate Atlas with captureBodies/spill enabled.',
    };
  }

  const maxChars = Math.min(Math.max(options?.maxChars ?? 32_000, 1_000), 200_000);
  const truncated = bodyText.length > maxChars;
  return {
    exists: true,
    eventId: id,
    found: true,
    truncated,
    bodyText: truncated ? bodyText.slice(0, maxChars) : bodyText,
    hop,
    spill:
      spill.request || spill.response
        ? {
            request: spill.request
              ? spill.request.length > maxChars
                ? spill.request.slice(0, maxChars)
                : spill.request
              : undefined,
            response: spill.response
              ? spill.response.length > maxChars
                ? spill.response.slice(0, maxChars)
                : spill.response
              : undefined,
          }
        : undefined,
  };
}

/**
 * Compact doc projection for MCP (pages / screens / prefetches without huge props samples).
 */
export function summarizeAtlasDoc(doc: {
  scenario?: string;
  updatedAt?: string;
  pages?: Record<string, {
    pageId: string;
    pageSlug?: string;
    lastSeenAt?: string;
    nodes?: Record<string, {
      nodeId: string;
      type?: string;
      path?: string;
      label?: string;
      datasources?: Array<{ datasourceId: string; lastRequestId?: string; operations?: string[] }>;
    }>;
    placements?: Array<{ treePath: string; depth?: number }>;
  }>;
  screens?: Record<string, {
    screen: string;
    components?: string[];
    datasourceIds?: string[];
    lastSeenAt?: string;
  }>;
  prefetches?: Record<string, {
    datasourceId: string;
    kind?: string;
    operations?: string[];
    phases?: string[];
    lastRequestId?: string;
    lastSeenAt?: string;
  }>;
}): {
  scenario?: string;
  updatedAt?: string;
  pageCount: number;
  screenCount: number;
  prefetchCount: number;
  pages: Array<{
    pageId: string;
    pageSlug?: string;
    lastSeenAt?: string;
    nodeCount: number;
    treePaths: string[];
    datasources: Array<{ datasourceId: string; lastRequestId?: string; operations?: string[] }>;
  }>;
  screens: Array<{
    screen: string;
    components: string[];
    datasourceIds: string[];
    lastSeenAt?: string;
  }>;
  prefetches: Array<{
    datasourceId: string;
    kind?: string;
    operations: string[];
    phases: string[];
    lastRequestId?: string;
    lastSeenAt?: string;
  }>;
} {
  const pages = Object.values(doc.pages ?? {}).map((page) => {
    const nodes = Object.values(page.nodes ?? {});
    const dsMap = new Map<string, { datasourceId: string; lastRequestId?: string; operations?: string[] }>();
    for (const node of nodes) {
      for (const d of node.datasources ?? []) {
        const prev = dsMap.get(d.datasourceId);
        if (!prev) {
          dsMap.set(d.datasourceId, {
            datasourceId: d.datasourceId,
            lastRequestId: d.lastRequestId,
            operations: d.operations,
          });
        } else if (d.lastRequestId) {
          prev.lastRequestId = d.lastRequestId;
        }
      }
    }
    return {
      pageId: page.pageId,
      pageSlug: page.pageSlug,
      lastSeenAt: page.lastSeenAt,
      nodeCount: nodes.length,
      treePaths: (page.placements ?? []).map((p) => p.treePath).filter(Boolean),
      datasources: [...dsMap.values()],
    };
  });

  const screens = Object.values(doc.screens ?? {}).map((s) => ({
    screen: s.screen,
    components: s.components ?? [],
    datasourceIds: s.datasourceIds ?? [],
    lastSeenAt: s.lastSeenAt,
  }));

  const prefetches = Object.values(doc.prefetches ?? {}).map((p) => ({
    datasourceId: p.datasourceId,
    kind: p.kind,
    operations: p.operations ?? [],
    phases: p.phases ?? [],
    lastRequestId: p.lastRequestId,
    lastSeenAt: p.lastSeenAt,
  }));

  return {
    scenario: doc.scenario,
    updatedAt: doc.updatedAt,
    pageCount: pages.length,
    screenCount: screens.length,
    prefetchCount: prefetches.length,
    pages,
    screens,
    prefetches,
  };
}
