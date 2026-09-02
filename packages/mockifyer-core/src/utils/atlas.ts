import { ENV_VARS, type MockifyerConfig } from '../types';
import { randomEventId, truncateUtf8, utf8ByteLength } from './crypto-digest';
import { recordUsage, setAtlasUsageSessionId, resetAtlasUsageRuntime, setAtlasUsageDashboardBaseUrl } from './atlas-usage';
import {
  resetAtlasDocRuntime,
  upsertAtlasDocFromPrefetch,
  upsertAtlasDocFromPresentation,
} from './atlas-doc';
import { setAtlasDocHtmlOutputPath } from './atlas-doc-html';
import { resetAtlasScreenshotRuntime } from './atlas-screenshot';
import {
  configureAtlasScreenshotCapture,
  resolveAtlasCaptureScreenshots,
} from './atlas-screenshot';
/** Atlas capture mode — `off` by default. */
export type AtlasMode = 'off' | 'live' | 'session';

/** How much of component props to store on presentation events. */
export type AtlasCaptureValues = 'off' | 'sample' | 'schema' | 'full';

export type AtlasDatasourceKind = 'graphql' | 'rest' | 'static' | 'unknown';

export type AtlasPrefetchPhase = 'login' | 'bootstrap' | 'prefetch' | 'manual';

export type AtlasSurfaceSource = 'cms' | 'hardcoded';

/** One datasource (or GQL slice) used while building props for a surface. */
export interface AtlasDatasourceRef {
  datasourceId: string;
  requestId: string;
  dataRoot?: string;
  kind?: AtlasDatasourceKind;
  operation?: string;
  source?: 'prefetch' | 'prefetch-gql' | 'live' | 'cache';
  role?: 'primary' | 'enrichment' | string;
}

export interface AtlasCmsNode {
  pageId: string;
  pageSlug?: string;
  nodeId: string;
  type: string;
  path: string;
  parentId?: string | null;
  source: AtlasSurfaceSource;
  label?: string;
}

export interface AtlasPrefetchEvent {
  id: string;
  kind: 'prefetch';
  timestamp: string;
  sessionId: string;
  scenario: string;
  clientId?: string | null;
  datasourceId: string;
  requestId: string;
  datasourceKind?: AtlasDatasourceKind;
  operation?: string;
  phase: AtlasPrefetchPhase;
}

export interface AtlasPresentationEvent {
  id: string;
  kind: 'presentation';
  timestamp: string;
  sessionId: string;
  scenario: string;
  clientId?: string | null;
  cms: AtlasCmsNode;
  datasources: AtlasDatasourceRef[];
  /** Sampled / schema / full props — omitted when captureValues is off. */
  shown?: unknown;
}

export type AtlasEvent = AtlasPrefetchEvent | AtlasPresentationEvent;

export interface AtlasConfig {
  /** When false, all capture is a no-op. Env `MOCKIFYER_ATLAS` also gates. */
  enabled?: boolean;
  mode?: AtlasMode;
  dashboardBaseUrl?: string;
  captureValues?: AtlasCaptureValues;
  /** Max UTF-8 bytes for serialized `shown` snapshots (default 8192). */
  maxShownBytes?: number;
  /**
   * Directory for self-contained auto-doc HTML (Node). Env `MOCKIFYER_ATLAS_HTML_PATH` wins.
   * Default when atlas is on: `{mockDataPath}/atlas-html`.
   */
  htmlOutputPath?: string;
  /**
   * When true (and {@link registerAtlasScreenshotCapturer} is wired), capture one PNG per
   * sessionId+screen when the app calls {@link requestAtlasScreenshotCapture} / presentation
   * settle (not on raw screen mount). Default false. Env `MOCKIFYER_ATLAS_SCREENSHOTS` can force on/off.
   */
  captureScreenshots?: boolean;
  /**
   * Ms to wait after layout paint before taking a screenshot (lets skeletons finish).
   * Default 600. Set `0` for tests.
   */
  screenshotSettleMs?: number;
  /**
   * When to write PNG files. Default `on-flush` (Dev Menu render / crash export).
   * Use `immediate` to write as soon as each screen is captured.
   */
  screenshotPersist?: 'immediate' | 'on-flush';
}

export interface AtlasRuntimeState {
  mode: AtlasMode;
  sessionId: string | null;
  scenario: string;
  clientId?: string | null;
  dashboardBaseUrl?: string;
  captureValues: AtlasCaptureValues;
  maxShownBytes: number;
  /** Resolved HTML output directory (Node); undefined when unset / RN. */
  htmlOutputPath?: string;
  /** In-process buffer (also POSTed when dashboard URL is set). */
  events: AtlasEvent[];
}

const DEFAULT_MAX_SHOWN_BYTES = 8_192;
const DEFAULT_MAX_EVENTS = 2_000;

let runtime: AtlasRuntimeState = {
  mode: 'off',
  sessionId: null,
  scenario: 'default',
  captureValues: 'sample',
  maxShownBytes: DEFAULT_MAX_SHOWN_BYTES,
  events: [],
};

function readEnvMode(): AtlasMode | undefined {
  if (typeof process === 'undefined') return undefined;
  const raw = process.env[ENV_VARS.MOCK_ATLAS]?.trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === 'off' || raw === 'false' || raw === '0' || raw === 'no') return 'off';
  if (raw === 'live' || raw === 'true' || raw === '1' || raw === 'on' || raw === 'yes') return 'live';
  if (raw === 'session') return 'session';
  return undefined;
}

/**
 * Resolves atlas mode: env `MOCKIFYER_ATLAS` wins, then config, then `off`.
 */
export function resolveAtlasMode(
  config?: Pick<MockifyerConfig, 'atlas'> | AtlasConfig | null
): AtlasMode {
  const fromEnv = readEnvMode();
  if (fromEnv) return fromEnv;
  if (config && 'enabled' in config && config.enabled === false) return 'off';
  const mode = config && 'mode' in config ? config.mode : (config as MockifyerConfig)?.atlas?.mode;
  if (mode === 'live' || mode === 'session' || mode === 'off') return mode;
  if (config && 'enabled' in config && config.enabled === true) return 'live';
  const nested = (config as MockifyerConfig)?.atlas;
  if (nested?.enabled === true && !nested.mode) return 'live';
  return 'off';
}

export function isAtlasEnabled(): boolean {
  return runtime.mode !== 'off';
}

export function getAtlasMode(): AtlasMode {
  return runtime.mode;
}

export function getAtlasSessionId(): string | null {
  return runtime.sessionId;
}

export function getAtlasEvents(): readonly AtlasEvent[] {
  return runtime.events;
}

function resolveDashboardUrl(
  config?: Pick<MockifyerConfig, 'atlas' | 'networkLog' | 'proxy'> | null
): string | undefined {
  if (typeof process !== 'undefined') {
    const fromEnv = process.env[ENV_VARS.MOCK_DASHBOARD_URL]?.trim();
    if (fromEnv) return fromEnv;
  }
  const atlasUrl = config && 'atlas' in (config as object)
    ? (config as MockifyerConfig).atlas?.dashboardBaseUrl?.trim()
    : (config as AtlasConfig | undefined)?.dashboardBaseUrl?.trim();
  if (atlasUrl) return atlasUrl;
  const nested = (config as MockifyerConfig | undefined)?.networkLog?.dashboardBaseUrl?.trim();
  if (nested) return nested;
  const proxy = (config as MockifyerConfig | undefined)?.proxy?.baseUrl?.trim();
  return proxy || undefined;
}

/**
 * Resolve HTML output directory for auto-doc files.
 * Priority: `MOCKIFYER_ATLAS_HTML_PATH` → `atlas.htmlOutputPath` → `{mockDataPath}/atlas-html` when atlas is on.
 */
export function resolveAtlasHtmlOutputPath(
  config?: (Pick<MockifyerConfig, 'atlas'> & { mockDataPath?: string }) | AtlasConfig | null,
  mode: AtlasMode = 'off'
): string | undefined {
  if (typeof process !== 'undefined') {
    const fromEnv = process.env[ENV_VARS.MOCK_ATLAS_HTML_PATH]?.trim();
    if (fromEnv) return fromEnv;
  }

  const atlasCfg =
    config && 'atlas' in (config as object) && (config as MockifyerConfig).atlas
      ? (config as MockifyerConfig).atlas
      : (config as AtlasConfig | undefined);
  const explicit = atlasCfg?.htmlOutputPath?.trim();
  if (explicit) return explicit;

  if (mode === 'off') return undefined;

  const mockDataPath =
    config && 'mockDataPath' in (config as object)
      ? (config as { mockDataPath?: string }).mockDataPath?.trim()
      : undefined;
  if (!mockDataPath) return undefined;

  const base = mockDataPath.replace(/[/\\]+$/, '');
  return `${base}/atlas-html`;
}

/**
 * Configure atlas capture (typically once at `setupMockifyer`).
 * Safe to call repeatedly; starts a session when mode is `live` or `session` and none is active.
 * Resolves and stores {@link AtlasRuntimeState.htmlOutputPath} for on-capture HTML generation.
 */
export function configureAtlas(
  config?: (Pick<MockifyerConfig, 'atlas' | 'networkLog' | 'proxy'> & { mockDataPath?: string }) | null,
  options?: { scenario?: string; clientId?: string | null }
): AtlasRuntimeState {
  const atlasCfg = (config as MockifyerConfig | undefined)?.atlas ?? (config as AtlasConfig | undefined);
  const mode = resolveAtlasMode(atlasCfg ?? null);
  const captureValues =
    atlasCfg && 'captureValues' in atlasCfg && atlasCfg.captureValues
      ? atlasCfg.captureValues
      : 'sample';
  const maxShownBytes =
    atlasCfg && 'maxShownBytes' in atlasCfg && typeof atlasCfg.maxShownBytes === 'number'
      ? atlasCfg.maxShownBytes
      : DEFAULT_MAX_SHOWN_BYTES;
  const htmlOutputPath = resolveAtlasHtmlOutputPath(config ?? null, mode);

  runtime = {
    ...runtime,
    mode,
    scenario: options?.scenario?.trim() || runtime.scenario || 'default',
    clientId: options?.clientId ?? runtime.clientId,
    dashboardBaseUrl: resolveDashboardUrl(config ?? null),
    captureValues,
    maxShownBytes,
    htmlOutputPath,
  };

  setAtlasUsageDashboardBaseUrl(runtime.dashboardBaseUrl);
  setAtlasDocHtmlOutputPath(htmlOutputPath);
  configureAtlasScreenshotCapture({
    enabled: resolveAtlasCaptureScreenshots(atlasCfg ?? null),
    htmlOutputPath,
    settleMs:
      atlasCfg && 'screenshotSettleMs' in atlasCfg && typeof atlasCfg.screenshotSettleMs === 'number'
        ? atlasCfg.screenshotSettleMs
        : undefined,
    persistMode:
      atlasCfg && 'screenshotPersist' in atlasCfg
        ? atlasCfg.screenshotPersist
        : undefined,
  });

  if (mode !== 'off' && !runtime.sessionId) {
    startAtlasSession();
  }
  if (mode === 'off') {
    runtime.sessionId = null;
  }

  return { ...runtime, events: [...runtime.events] };
}

/** Start (or replace) the active atlas session id. */
export function startAtlasSession(sessionId?: string): string {
  const id =
    sessionId?.trim() ||
    `atlas-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  runtime.sessionId = id;
  setAtlasUsageSessionId(id);
  return id;
}

/** End the session; returns buffered events for export. Does not clear the buffer. */
export function endAtlasSession(): { sessionId: string | null; events: AtlasEvent[] } {
  const sessionId = runtime.sessionId;
  const events = [...runtime.events];
  runtime.sessionId = null;
  setAtlasUsageSessionId(null);
  return { sessionId, events };
}

/** Clear the in-process event buffer (e.g. after export). */
export function clearAtlasEvents(): void {
  runtime.events = [];
}

/** Reset runtime (tests). */
export function resetAtlasRuntime(): void {
  runtime = {
    mode: 'off',
    sessionId: null,
    scenario: 'default',
    captureValues: 'sample',
    maxShownBytes: DEFAULT_MAX_SHOWN_BYTES,
    events: [],
  };
  setAtlasUsageSessionId(null);
  resetAtlasUsageRuntime();
  resetAtlasDocRuntime();
  resetAtlasScreenshotRuntime();
}

function pushEvent(event: AtlasEvent): void {
  runtime.events.unshift(event);
  if (runtime.events.length > DEFAULT_MAX_EVENTS) {
    runtime.events.length = DEFAULT_MAX_EVENTS;
  }
  // `session` buffers locally; `live` posts when a dashboard URL is configured.
  if (runtime.mode === 'live') {
    void postAtlasEvent(event);
  }
}

async function postAtlasEvent(event: AtlasEvent): Promise<void> {
  const base = runtime.dashboardBaseUrl?.trim();
  if (!base || typeof fetch !== 'function') return;
  const url = `${base.replace(/\/+$/, '')}/api/atlas/events`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event }),
    });
  } catch {
    // Observability must not break the app
  }
}

/**
 * Sample / schema / truncate a props snapshot for atlas storage.
 */
export function sampleDeep(
  value: unknown,
  options?: { mode?: AtlasCaptureValues; maxBytes?: number; maxArrayItems?: number; depth?: number }
): unknown {
  const mode = options?.mode ?? runtime.captureValues;
  if (mode === 'off') return undefined;
  const maxBytes = options?.maxBytes ?? runtime.maxShownBytes;
  const maxArrayItems = options?.maxArrayItems ?? 3;
  const maxDepth = options?.depth ?? 6;

  function walk(v: unknown, depth: number): unknown {
    if (mode === 'schema') {
      if (v === null || v === undefined) return v === null ? 'null' : 'undefined';
      if (Array.isArray(v)) return `array(${v.length})`;
      if (typeof v === 'object') {
        const keys = Object.keys(v as object);
        return Object.fromEntries(keys.map((k) => [k, walk((v as Record<string, unknown>)[k], depth + 1)]));
      }
      return typeof v;
    }
    if (depth >= maxDepth) {
      if (Array.isArray(v)) return `[…${v.length} items]`;
      if (v && typeof v === 'object') return '{…}';
      return v;
    }
    if (Array.isArray(v)) {
      const slice = v.slice(0, maxArrayItems).map((item) => walk(item, depth + 1));
      if (v.length > maxArrayItems) {
        slice.push(`…+${v.length - maxArrayItems} more`);
      }
      return slice;
    }
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        out[k] = walk(child, depth + 1);
      }
      return out;
    }
    if (typeof v === 'string' && utf8ByteLength(v) > 256) {
      return truncateUtf8(v, 256);
    }
    return v;
  }

  const walked = walk(value, 0);
  if (mode === 'full') {
    try {
      const text = JSON.stringify(walked);
      if (utf8ByteLength(text) <= maxBytes) return walked;
      return JSON.parse(truncateUtf8(text, maxBytes));
    } catch {
      return walked;
    }
  }
  try {
    const text = JSON.stringify(walked);
    if (utf8ByteLength(text) <= maxBytes) return walked;
    return JSON.parse(truncateUtf8(text, maxBytes));
  } catch {
    return walked;
  }
}

export interface CapturePrefetchInput {
  datasourceId: string;
  requestId: string;
  kind?: AtlasDatasourceKind;
  operation?: string;
  phase?: AtlasPrefetchPhase;
  scenario?: string;
  clientId?: string | null;
  sessionId?: string;
}

/** Record that a datasource was prefetched (login/bootstrap). No-op when atlas is off. */
export function capturePrefetch(input: CapturePrefetchInput): AtlasPrefetchEvent | null {
  if (!isAtlasEnabled()) return null;
  const sessionId = input.sessionId ?? runtime.sessionId ?? startAtlasSession();
  const event: AtlasPrefetchEvent = {
    id: randomEventId(),
    kind: 'prefetch',
    timestamp: new Date().toISOString(),
    sessionId,
    scenario: input.scenario?.trim() || runtime.scenario,
    clientId: input.clientId ?? runtime.clientId ?? null,
    datasourceId: input.datasourceId,
    requestId: input.requestId,
    datasourceKind: input.kind,
    operation: input.operation,
    phase: input.phase ?? 'prefetch',
  };
  pushEvent(event);
  upsertAtlasDocFromPrefetch({
    scenario: event.scenario,
    datasourceId: event.datasourceId,
    kind: event.datasourceKind,
    operation: event.operation,
    phase: event.phase,
    requestId: event.requestId,
    timestamp: event.timestamp,
  });
  return event;
}

export interface CapturePresentationInput {
  cms: Omit<AtlasCmsNode, 'source'> & { source?: AtlasSurfaceSource };
  datasources?: AtlasDatasourceRef[];
  shown?: unknown;
  scenario?: string;
  clientId?: string | null;
  sessionId?: string;
}

/** Record that a CMS/hardcoded surface rendered with these datasources. No-op when atlas is off. */
export function capturePresentation(input: CapturePresentationInput): AtlasPresentationEvent | null {
  if (!isAtlasEnabled()) return null;
  const sessionId = input.sessionId ?? runtime.sessionId ?? startAtlasSession();
  const shown =
    runtime.captureValues === 'off'
      ? undefined
      : input.shown !== undefined
        ? sampleDeep(input.shown)
        : undefined;

  const event: AtlasPresentationEvent = {
    id: randomEventId(),
    kind: 'presentation',
    timestamp: new Date().toISOString(),
    sessionId,
    scenario: input.scenario?.trim() || runtime.scenario,
    clientId: input.clientId ?? runtime.clientId ?? null,
    cms: {
      ...input.cms,
      source: input.cms.source ?? 'cms',
    },
    datasources: input.datasources ?? [],
    shown,
  };
  pushEvent(event);

  upsertAtlasDocFromPresentation({
    scenario: event.scenario,
    timestamp: event.timestamp,
    cms: event.cms,
    datasources: event.datasources.map((d) => ({
      datasourceId: d.datasourceId,
      dataRoot: d.dataRoot,
      kind: d.kind,
      operation: d.operation,
      requestId: d.requestId,
    })),
    shown: event.shown,
  });

  // Stitch CMS presentation onto the trace spine by requestId
  for (const ds of event.datasources) {
    if (!ds.requestId?.trim()) continue;
    recordUsage({
      requestId: ds.requestId,
      scenario: event.scenario,
      sessionId: event.sessionId,
      clientId: event.clientId,
      usage: {
        screen: event.cms.pageSlug || event.cms.pageId,
        component: event.cms.type,
        label: event.cms.label || event.cms.type,
        cms: {
          pageId: event.cms.pageId,
          nodeId: event.cms.nodeId,
          type: event.cms.type,
          path: event.cms.path,
        },
        datasourceId: ds.datasourceId,
        dataRoot: ds.dataRoot,
      },
    });
  }

  return event;
}

/**
 * Opt-in capture for hardcoded React surfaces (header cart, checkout strip, etc.).
 */
export function captureTrackedSurface(input: {
  id: string;
  label?: string;
  datasources?: AtlasDatasourceRef[];
  shown?: unknown;
  pageId?: string;
  path?: string;
}): AtlasPresentationEvent | null {
  return capturePresentation({
    cms: {
      pageId: input.pageId ?? '_app',
      nodeId: input.id,
      type: input.id,
      path: input.path ?? `_app/${input.id}`,
      source: 'hardcoded',
      label: input.label,
    },
    datasources: input.datasources,
    shown: input.shown,
  });
}

/** Build a CMS tree from presentation events for a session (dashboard / export). */
export interface AtlasTreeNode {
  nodeId: string;
  type: string;
  path: string;
  pageId: string;
  label?: string;
  source: AtlasSurfaceSource;
  datasources: AtlasDatasourceRef[];
  shown?: unknown;
  children: AtlasTreeNode[];
  eventId: string;
  timestamp: string;
}

export function buildAtlasTree(events: readonly AtlasEvent[], sessionId?: string): AtlasTreeNode[] {
  const presentations = events.filter(
    (e): e is AtlasPresentationEvent =>
      e.kind === 'presentation' && (!sessionId || e.sessionId === sessionId)
  );

  /** Newest events first in the buffer — keep first write per nodeId (latest wins). */
  const byId = new Map<string, AtlasTreeNode & { parentId?: string | null }>();

  for (const ev of presentations) {
    if (byId.has(ev.cms.nodeId)) continue;
    byId.set(ev.cms.nodeId, {
      nodeId: ev.cms.nodeId,
      type: ev.cms.type,
      path: ev.cms.path,
      pageId: ev.cms.pageId,
      label: ev.cms.label,
      source: ev.cms.source,
      datasources: ev.datasources,
      shown: ev.shown,
      children: [],
      eventId: ev.id,
      timestamp: ev.timestamp,
      parentId: ev.cms.parentId,
    });
  }

  const roots: AtlasTreeNode[] = [];
  for (const node of byId.values()) {
    const parentId = node.parentId;
    if (parentId && byId.has(parentId) && parentId !== node.nodeId) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRecursive = (nodes: AtlasTreeNode[]) => {
    nodes.sort((a, b) => a.path.localeCompare(b.path) || a.nodeId.localeCompare(b.nodeId));
    for (const n of nodes) sortRecursive(n.children);
  };
  sortRecursive(roots);
  return roots;
}
