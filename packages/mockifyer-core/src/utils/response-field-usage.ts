import type { AtlasDocMap, AtlasDocNode, AtlasDocPage } from './atlas-doc';
import { usageListForHop } from './hop-display';
import type { NetworkEvent } from './network-event-types';

export interface LinkedGuiNodeRef {
  pageId: string;
  nodeId: string;
  type: string;
  label?: string;
  propsSample?: unknown;
  dataRoot?: string;
}

export interface UsedResponseFieldResult {
  /** Dot paths in the response JSON that match GUI props (e.g. `data.user.email`). */
  paths: string[];
  nodes: LinkedGuiNodeRef[];
}

const KEY_PREFIX = '__key__:';

function normalizePrimitive(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/** Collect primitive leaf values and key names from props shown in the GUI. */
export function collectPropsUsageSignals(propsSample: unknown): { values: Set<string>; keys: Set<string> } {
  const values = new Set<string>();
  const keys = new Set<string>();

  function walk(value: unknown): void {
    if (value === null || typeof value !== 'object') {
      values.add(normalizePrimitive(value));
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      keys.add(k);
      values.add(`${KEY_PREFIX}${k}`);
      walk(v);
    }
  }

  walk(propsSample);
  return { values, keys };
}

/** Resolve optional dataRoot (`data.booking`, `$.data.items`). */
export function resolveDataRoot(value: unknown, dataRoot?: string): unknown {
  const raw = dataRoot?.trim();
  if (!raw || value == null || typeof value !== 'object') return value;

  let path = raw.replace(/^\$\.?/, '');
  let cur: unknown = value;
  for (const seg of path.split('.')) {
    if (!seg || cur == null || typeof cur !== 'object') return value;
    if (Array.isArray(cur)) {
      const index = Number(seg);
      cur = Number.isInteger(index) ? cur[index] : undefined;
    } else {
      cur = (cur as Record<string, unknown>)[seg];
    }
  }
  return cur ?? value;
}

function pathHasUsedDescendant(path: string, usedPaths: ReadonlySet<string>): boolean {
  if (usedPaths.has(path)) return true;
  const prefix = `${path}.`;
  for (const p of usedPaths) {
    if (p.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Walk response JSON and mark paths whose keys/values appear in GUI propsSample.
 * Matches by key name and primitive value equality (best-effort — props may be transformed).
 */
export function collectUsedResponsePaths(
  response: unknown,
  propsSamples: unknown[],
  options?: { dataRoots?: string[] }
): Set<string> {
  const used = new Set<string>();
  if (response == null || propsSamples.length === 0) return used;

  const signals = { values: new Set<string>(), keys: new Set<string>() };
  for (const sample of propsSamples) {
    const part = collectPropsUsageSignals(sample);
    part.values.forEach((v) => signals.values.add(v));
    part.keys.forEach((k) => signals.keys.add(k));
  }

  const roots = options?.dataRoots?.filter(Boolean) ?? [];
  const scopes =
    roots.length > 0
      ? roots.map((r) => ({ base: resolveDataRoot(response, r), prefix: r.replace(/^\$\.?/, '') }))
      : [{ base: response, prefix: '' }];

  function markPath(path: string): void {
    if (path) used.add(path);
  }

  function walk(node: unknown, pathPrefix: string): void {
    if (node === null || typeof node !== 'object') {
      if (signals.values.has(normalizePrimitive(node))) markPath(pathPrefix);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => {
        const childPath = pathPrefix ? `${pathPrefix}.${index}` : String(index);
        walk(item, childPath);
      });
      return;
    }
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      if (signals.keys.has(key) || signals.values.has(`${KEY_PREFIX}${key}`)) {
        markPath(childPath);
      }
      if (val === null || typeof val !== 'object') {
        if (signals.values.has(normalizePrimitive(val))) markPath(childPath);
      }
      walk(val, childPath);
    }
  }

  for (const scope of scopes) {
    if (scope.base == null) continue;
    walk(scope.base, scope.prefix);
  }

  // Promote ancestors when a descendant matched (highlight enclosing objects).
  const sorted = [...used].sort((a, b) => b.length - a.length);
  for (const p of sorted) {
    let cur = p;
    while (cur.includes('.')) {
      cur = cur.slice(0, cur.lastIndexOf('.'));
      used.add(cur);
    }
  }

  return used;
}

function nodeRef(page: AtlasDocPage, node: AtlasDocNode, dataRoot?: string): LinkedGuiNodeRef {
  return {
    pageId: page.pageId,
    nodeId: node.nodeId,
    type: node.type,
    label: node.label,
    propsSample: node.propsSample,
    dataRoot,
  };
}

/** CMS nodes whose datasource or usage links to this hop. */
export function findLinkedGuiNodes(
  doc: AtlasDocMap,
  hop: Pick<NetworkEvent, 'requestId' | 'usage'>
): LinkedGuiNodeRef[] {
  const rid = hop.requestId?.trim();
  const out: LinkedGuiNodeRef[] = [];
  const seen = new Set<string>();

  function push(ref: LinkedGuiNodeRef): void {
    const key = `${ref.pageId}\0${ref.nodeId}\0${ref.dataRoot ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(ref);
  }

  for (const page of Object.values(doc.pages ?? {})) {
    for (const node of Object.values(page.nodes ?? {})) {
      for (const ds of node.datasources ?? []) {
        if (rid && ds.lastRequestId === rid) {
          push(nodeRef(page, node, ds.dataRoot));
        }
      }
    }
  }

  for (const usage of usageListForHop(hop as NetworkEvent)) {
    const pageId = usage.cms?.pageId?.trim();
    const nodeId = usage.cms?.nodeId?.trim();
    if (!pageId || !nodeId) continue;
    const page = doc.pages?.[pageId];
    const node = page?.nodes?.[nodeId];
    if (page && node) {
      push(nodeRef(page, node, usage.dataRoot));
    }
  }

  return out;
}

function parseResponseBody(text: string | undefined): unknown | undefined {
  if (text == null || text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Compute used response field paths for a hop from linked GUI props samples. */
export function computeUsedResponsePaths(
  doc: AtlasDocMap,
  hop: Pick<NetworkEvent, 'requestId' | 'usage' | 'responseBodyPreview'>
): UsedResponseFieldResult {
  const nodes = findLinkedGuiNodes(doc, hop);
  const samples = nodes
    .map((n) => n.propsSample)
    .filter((s): s is NonNullable<typeof s> => s !== undefined);
  if (!samples.length) {
    return { paths: [], nodes };
  }

  const parsed = parseResponseBody(hop.responseBodyPreview);
  if (parsed === undefined) {
    return { paths: [], nodes };
  }

  const dataRoots = [...new Set(nodes.map((n) => n.dataRoot?.trim()).filter(Boolean) as string[])];
  const paths = collectUsedResponsePaths(parsed, samples, { dataRoots });
  return { paths: [...paths].sort(), nodes };
}

/** Whether a JSON dot-path is directly used or has used descendants. */
export function isResponsePathUsed(
  path: string,
  usedPaths: ReadonlySet<string>
): 'direct' | 'descendant' | 'unused' {
  if (usedPaths.has(path)) return 'direct';
  if (pathHasUsedDescendant(path, usedPaths)) return 'descendant';
  return 'unused';
}
