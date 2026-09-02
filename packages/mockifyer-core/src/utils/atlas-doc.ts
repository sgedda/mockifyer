/**
 * Auto-documentation map for Atlas — upsert by stable ids (page/node/screen).
 * Structure is a union across users/sessions; prop *values* keep last sample + schema.
 * When HTML output is configured (see atlas-doc-html), upserts schedule a debounced rewrite.
 */

import {
  resetAtlasDocHtmlRuntime,
  scheduleAtlasDocHtmlRewrite,
} from './atlas-doc-html';

export type AtlasDocSchema =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'unknown'
  | 'mixed'
  | AtlasDocSchema[]
  | { [key: string]: AtlasDocSchema };

export interface AtlasDocDatasourceEdge {
  datasourceId: string;
  dataRoot?: string;
  kind?: string;
  /** Union of seen GraphQL/REST operation names. */
  operations: string[];
  /** Last hop id that produced this edge (for Network jump). */
  lastRequestId?: string;
}

export interface AtlasDocNode {
  nodeId: string
  type: string
  path: string
  label?: string
  source: 'cms' | 'hardcoded'
  parentId?: string | null
  datasources: AtlasDocDatasourceEdge[]
  /** Inferred types from shown props (union across visits). */
  propsSchema?: AtlasDocSchema
  /** Last seen sample (illustration only — not multi-user truth). */
  propsSample?: unknown
  lastSeenAt: string
}

export interface AtlasDocPage {
  pageId: string
  pageSlug?: string
  nodes: Record<string, AtlasDocNode>
  lastSeenAt: string
  /** Relative path under atlas-html when captured via CMS presentation. */
  screenshotPath?: string
  screenshotSessionId?: string
  screenshotCapturedAt?: string
}

/** Light doc entry when only usage.screen is known (no CMS presentation). */
export interface AtlasDocScreen {
  screen: string
  components: string[]
  datasourceIds: string[]
  lastSeenAt: string
  /** Relative path under atlas-html, e.g. `screenshots/session__screen.png`. */
  screenshotPath?: string
  screenshotSessionId?: string
  screenshotCapturedAt?: string
}

export interface AtlasDocPrefetch {
  datasourceId: string;
  kind?: string;
  operations: string[];
  phases: string[];
  lastSeenAt: string;
  /** Last hop id for this prefetch datasource. */
  lastRequestId?: string;
}

export interface AtlasDocMap {
  scenario: string
  updatedAt: string
  pages: Record<string, AtlasDocPage>
  screens: Record<string, AtlasDocScreen>
  prefetches: Record<string, AtlasDocPrefetch>
}

const docsByScenario = new Map<string, AtlasDocMap>()

function emptyMap(scenario: string): AtlasDocMap {
  return {
    scenario: scenario.trim() || 'default',
    updatedAt: new Date().toISOString(),
    pages: {},
    screens: {},
    prefetches: {},
  }
}

function touch(map: AtlasDocMap): AtlasDocMap {
  map.updatedAt = new Date().toISOString()
  return map
}

function ensureMap(scenario: string): AtlasDocMap {
  const key = scenario.trim() || 'default'
  let map = docsByScenario.get(key)
  if (!map) {
    map = emptyMap(key)
    docsByScenario.set(key, map)
  }
  return map
}

/** Infer a lightweight JSON-ish schema from a value. */
export function inferValueSchema(value: unknown, depth = 0): AtlasDocSchema {
  if (depth > 8) return 'unknown'
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    if (value.length === 0) return ['unknown']
    return [inferValueSchema(value[0], depth + 1)]
  }
  switch (typeof value) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'object': {
      const out: { [key: string]: AtlasDocSchema } = {}
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = inferValueSchema(v, depth + 1)
      }
      return out
    }
    default:
      return 'unknown'
  }
}

/** Merge schemas so multi-user structure becomes a union. */
export function mergeSchemas(a: AtlasDocSchema | undefined, b: AtlasDocSchema | undefined): AtlasDocSchema | undefined {
  if (a === undefined) return b
  if (b === undefined) return a
  if (a === b) return a
  if (a === 'mixed' || b === 'mixed') return 'mixed'

  if (Array.isArray(a) && Array.isArray(b)) {
    return [mergeSchemas(a[0], b[0]) ?? 'unknown']
  }

  if (
    typeof a === 'object' &&
    !Array.isArray(a) &&
    typeof b === 'object' &&
    !Array.isArray(b)
  ) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    const out: { [key: string]: AtlasDocSchema } = {}
    for (const k of keys) {
      out[k] = mergeSchemas(a[k], b[k]) ?? 'unknown'
    }
    return out
  }

  return 'mixed'
}

function datasourceKey(ds: { datasourceId: string; dataRoot?: string }): string {
  return `${ds.datasourceId}::${ds.dataRoot ?? ''}`
}

function mergeDatasourceEdge(
  existing: AtlasDocDatasourceEdge | undefined,
  incoming: {
    datasourceId: string;
    dataRoot?: string;
    kind?: string;
    operation?: string;
    requestId?: string;
  }
): AtlasDocDatasourceEdge {
  const operations = new Set(existing?.operations ?? []);
  if (incoming.operation?.trim()) operations.add(incoming.operation.trim());
  return {
    datasourceId: incoming.datasourceId,
    dataRoot: incoming.dataRoot ?? existing?.dataRoot,
    kind: incoming.kind ?? existing?.kind,
    operations: [...operations].sort(),
    lastRequestId: incoming.requestId?.trim() || existing?.lastRequestId,
  };
}

export interface UpsertDocPresentationInput {
  scenario?: string
  cms: {
    pageId: string
    pageSlug?: string
    nodeId: string
    type: string
    path: string
    parentId?: string | null
    source?: 'cms' | 'hardcoded'
    label?: string
  }
  datasources?: Array<{
    datasourceId: string;
    dataRoot?: string;
    kind?: string;
    operation?: string;
    requestId?: string;
  }>;
  shown?: unknown;
  timestamp?: string;
}

/** Upsert a CMS/hardcoded surface into the auto-doc map. */
export function upsertAtlasDocFromPresentation(input: UpsertDocPresentationInput): AtlasDocMap {
  const scenario = input.scenario?.trim() || 'default'
  const map = ensureMap(scenario)
  const now = input.timestamp ?? new Date().toISOString()
  const pageId = input.cms.pageId.trim() || '_app'

  let page = map.pages[pageId]
  if (!page) {
    page = { pageId, pageSlug: input.cms.pageSlug, nodes: {}, lastSeenAt: now }
    map.pages[pageId] = page
  } else {
    if (input.cms.pageSlug) page.pageSlug = input.cms.pageSlug
    page.lastSeenAt = now
  }

  const nodeId = input.cms.nodeId.trim() || input.cms.type
  const prev = page.nodes[nodeId]
  const byDs = new Map<string, AtlasDocDatasourceEdge>()
  for (const d of prev?.datasources ?? []) {
    byDs.set(datasourceKey(d), d)
  }
  for (const d of input.datasources ?? []) {
    if (!d.datasourceId?.trim()) continue
    const key = datasourceKey(d)
    byDs.set(key, mergeDatasourceEdge(byDs.get(key), d))
  }

  const sample = input.shown
  const schemaFromSample = sample !== undefined ? inferValueSchema(sample) : undefined

  page.nodes[nodeId] = {
    nodeId,
    type: input.cms.type,
    path: input.cms.path,
    label: input.cms.label ?? prev?.label,
    source: input.cms.source ?? prev?.source ?? 'cms',
    parentId: input.cms.parentId !== undefined ? input.cms.parentId : prev?.parentId,
    datasources: [...byDs.values()].sort((a, b) =>
      datasourceKey(a).localeCompare(datasourceKey(b))
    ),
    propsSchema: mergeSchemas(prev?.propsSchema, schemaFromSample),
    propsSample: sample !== undefined ? sample : prev?.propsSample,
    lastSeenAt: now,
  }

  const updated = touch(map)
  scheduleAtlasDocHtmlRewrite(updated)
  return updated
}

export interface UpsertDocPrefetchInput {
  scenario?: string;
  datasourceId: string;
  kind?: string;
  operation?: string;
  phase?: string;
  requestId?: string;
  timestamp?: string;
}

export function upsertAtlasDocFromPrefetch(input: UpsertDocPrefetchInput): AtlasDocMap {
  const scenario = input.scenario?.trim() || 'default';
  const map = ensureMap(scenario);
  const now = input.timestamp ?? new Date().toISOString();
  const id = input.datasourceId.trim();
  if (!id) return map;

  const prev = map.prefetches[id];
  const operations = new Set(prev?.operations ?? []);
  if (input.operation?.trim()) operations.add(input.operation.trim());
  const phases = new Set(prev?.phases ?? []);
  if (input.phase?.trim()) phases.add(input.phase.trim());

  map.prefetches[id] = {
    datasourceId: id,
    kind: input.kind ?? prev?.kind,
    operations: [...operations].sort(),
    phases: [...phases].sort(),
    lastSeenAt: now,
    lastRequestId: input.requestId?.trim() || prev?.lastRequestId,
  };
  const updated = touch(map);
  scheduleAtlasDocHtmlRewrite(updated);
  return updated;
}

export interface UpsertDocUsageInput {
  scenario?: string;
  screen?: string;
  component?: string;
  datasourceId?: string;
  dataRoot?: string;
  requestId?: string;
  cms?: {
    pageId?: string;
    nodeId?: string;
    type?: string;
    path?: string;
  };
  timestamp?: string;
}

/**
 * Upsert from usage annotations. CMS-shaped usage reinforces pages without
 * overwriting a friendlier presentation label; screen-only fills screens map.
 */
export function upsertAtlasDocFromUsage(input: UpsertDocUsageInput): AtlasDocMap {
  const scenario = input.scenario?.trim() || 'default';
  const map = ensureMap(scenario);
  const now = input.timestamp ?? new Date().toISOString();

  if (input.cms?.pageId && input.cms.nodeId) {
    upsertAtlasDocFromPresentation({
      scenario,
      timestamp: now,
      cms: {
        pageId: input.cms.pageId,
        nodeId: input.cms.nodeId,
        type: input.cms.type || input.component || input.cms.nodeId,
        path: input.cms.path || `${input.cms.pageId}/${input.cms.nodeId}`,
        // Do not pass label — preserves capturePresentation / tracked-surface labels.
      },
      datasources: input.datasourceId
        ? [
            {
              datasourceId: input.datasourceId,
              dataRoot: input.dataRoot,
              requestId: input.requestId,
            },
          ]
        : undefined,
    });
  }

  const screen = input.screen?.trim();
  if (screen) {
    const prev = map.screens[screen];
    const components = new Set(prev?.components ?? []);
    if (input.component?.trim()) components.add(input.component.trim());
    const datasourceIds = new Set(prev?.datasourceIds ?? []);
    if (input.datasourceId?.trim()) datasourceIds.add(input.datasourceId.trim());
    map.screens[screen] = {
      screen,
      components: [...components].sort(),
      datasourceIds: [...datasourceIds].sort(),
      lastSeenAt: now,
      screenshotPath: prev?.screenshotPath,
      screenshotSessionId: prev?.screenshotSessionId,
      screenshotCapturedAt: prev?.screenshotCapturedAt,
    };
    touch(map);
  }

  scheduleAtlasDocHtmlRewrite(map);
  return map;
}

export interface SetAtlasDocScreenshotInput {
  scenario?: string;
  screen: string;
  sessionId: string;
  screenshotPath: string;
  capturedAt: string;
  pageId?: string;
}

/** Persist screenshot path on screen / page entries after capture. */
export function setAtlasDocScreenshot(input: SetAtlasDocScreenshotInput): AtlasDocMap {
  const scenario = input.scenario?.trim() || 'default';
  const map = ensureMap(scenario);
  const screen = input.screen.trim();
  const now = input.capturedAt;

  const prevScreen = map.screens[screen];
  map.screens[screen] = {
    screen,
    components: prevScreen?.components ?? [],
    datasourceIds: prevScreen?.datasourceIds ?? [],
    lastSeenAt: prevScreen?.lastSeenAt ?? now,
    screenshotPath: input.screenshotPath,
    screenshotSessionId: input.sessionId,
    screenshotCapturedAt: input.capturedAt,
  };

  const pageId = input.pageId?.trim();
  if (pageId && map.pages[pageId]) {
    const page = map.pages[pageId];
    page.screenshotPath = input.screenshotPath;
    page.screenshotSessionId = input.sessionId;
    page.screenshotCapturedAt = input.capturedAt;
  }

  const updated = touch(map);
  scheduleAtlasDocHtmlRewrite(updated);
  return updated;
}

export function getAtlasDocMap(scenario = 'default'): AtlasDocMap {
  return structuredClone(ensureMap(scenario))
}

/** Replace or merge an entire map (dashboard hydrate / tests). */
export function setAtlasDocMap(map: AtlasDocMap): AtlasDocMap {
  const key = map.scenario.trim() || 'default'
  const normalized: AtlasDocMap = {
    ...map,
    scenario: key,
    pages: map.pages ?? {},
    screens: map.screens ?? {},
    prefetches: map.prefetches ?? {},
    updatedAt: map.updatedAt || new Date().toISOString(),
  }
  docsByScenario.set(key, normalized)
  return structuredClone(normalized)
}

/** Apply a partial map upsert from another process (dashboard POST). */
export function mergeAtlasDocMap(incoming: AtlasDocMap): AtlasDocMap {
  const scenario = incoming.scenario?.trim() || 'default'
  for (const pref of Object.values(incoming.prefetches ?? {})) {
    upsertAtlasDocFromPrefetch({
      scenario,
      datasourceId: pref.datasourceId,
      kind: pref.kind,
      operation: pref.operations?.[0],
      phase: pref.phases?.[0],
      timestamp: pref.lastSeenAt,
    })
    const map = ensureMap(scenario)
    const existing = map.prefetches[pref.datasourceId]
    if (existing) {
      const ops = new Set([...existing.operations, ...(pref.operations ?? [])])
      const phases = new Set([...existing.phases, ...(pref.phases ?? [])])
      existing.operations = [...ops].sort()
      existing.phases = [...phases].sort()
      if (pref.kind) existing.kind = pref.kind
      if (pref.lastSeenAt > existing.lastSeenAt) existing.lastSeenAt = pref.lastSeenAt
    }
  }

  for (const page of Object.values(incoming.pages ?? {})) {
    for (const node of Object.values(page.nodes ?? {})) {
      upsertAtlasDocFromPresentation({
        scenario,
        timestamp: node.lastSeenAt,
        cms: {
          pageId: page.pageId,
          pageSlug: page.pageSlug,
          nodeId: node.nodeId,
          type: node.type,
          path: node.path,
          parentId: node.parentId,
          source: node.source,
          label: node.label,
        },
        datasources: node.datasources.map((d) => ({
          datasourceId: d.datasourceId,
          dataRoot: d.dataRoot,
          kind: d.kind,
          operation: d.operations[0],
        })),
        shown: node.propsSample,
      })
      // Re-merge full operation unions + schemas
      const map = ensureMap(scenario)
      const target = map.pages[page.pageId]?.nodes[node.nodeId]
      if (target) {
        target.propsSchema = mergeSchemas(target.propsSchema, node.propsSchema)
        for (const d of node.datasources) {
          const key = datasourceKey(d)
          const found = target.datasources.find((x) => datasourceKey(x) === key)
          if (found) {
            const ops = new Set([...found.operations, ...d.operations])
            found.operations = [...ops].sort()
          } else {
            target.datasources.push({ ...d, operations: [...d.operations] })
          }
        }
      }
    }
  }

  for (const screen of Object.values(incoming.screens ?? {})) {
    for (const component of screen.components) {
      upsertAtlasDocFromUsage({
        scenario,
        screen: screen.screen,
        component,
        timestamp: screen.lastSeenAt,
      })
    }
    for (const datasourceId of screen.datasourceIds) {
      upsertAtlasDocFromUsage({
        scenario,
        screen: screen.screen,
        datasourceId,
        timestamp: screen.lastSeenAt,
      })
    }
    if (screen.screenshotPath?.trim()) {
      setAtlasDocScreenshot({
        scenario,
        screen: screen.screen,
        sessionId: screen.screenshotSessionId || 'imported',
        screenshotPath: screen.screenshotPath,
        capturedAt: screen.screenshotCapturedAt || screen.lastSeenAt,
      })
    }
  }

  for (const page of Object.values(incoming.pages ?? {})) {
    if (page.screenshotPath?.trim()) {
      const map = ensureMap(scenario)
      const existingPage = map.pages[page.pageId]
      if (existingPage) {
        existingPage.screenshotPath = page.screenshotPath
        existingPage.screenshotSessionId = page.screenshotSessionId || 'imported'
        existingPage.screenshotCapturedAt = page.screenshotCapturedAt || page.lastSeenAt
        touch(map)
      }
    }
  }

  return getAtlasDocMap(scenario)
}

export function clearAtlasDocMap(scenario?: string): void {
  if (scenario?.trim()) {
    docsByScenario.delete(scenario.trim())
    return
  }
  docsByScenario.clear()
}

export function resetAtlasDocRuntime(): void {
  docsByScenario.clear()
  resetAtlasDocHtmlRuntime()
}

/** Pages sorted for display. */
export function listAtlasDocPages(scenario = 'default'): AtlasDocPage[] {
  const map = ensureMap(scenario)
  return Object.values(map.pages).sort((a, b) => a.pageId.localeCompare(b.pageId))
}
