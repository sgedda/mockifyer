import type { MockData } from '../types';

export type AiContextMode = 'profile' | 'schema' | 'suggest' | 'full';

export interface AiFieldSchemaInfo {
  type: string;
  enum?: unknown[];
  nullable?: boolean;
}

export interface AiStateHint {
  path: string;
  observed: unknown[];
}

export interface ScoredAiPath {
  path: string;
  score: number;
  reasons: string[];
  sampleValue?: unknown;
}

export interface AiContextDiscoveryMeta {
  sources: string[];
  includedPaths: number;
  omittedPaths: number;
  omittedBytes: number;
  mode: AiContextMode;
}

export interface AiContextProfile {
  fields: Record<string, unknown>;
  schema: Record<string, AiFieldSchemaInfo>;
  stateHints: AiStateHint[];
}

export interface AiContextResult {
  endpoint: { method: string; url: string; pathname: string };
  status: number;
  mode: AiContextMode;
  profile: AiContextProfile;
  discovery: AiContextDiscoveryMeta;
  suggestions?: ScoredAiPath[];
  data?: MockData;
}

export interface AiContextOptions {
  mode?: AiContextMode;
  /** Max body paths to include in profile mode (default 25). */
  maxPaths?: number;
  /** Max JSON walk depth (default 8). */
  maxDepth?: number;
  /** Explicit include paths (normalized); merged with auto-discovery. */
  includePaths?: string[];
  /** Paths to exclude after scoring. */
  excludePaths?: string[];
}

interface PathWalkInfo {
  path: string;
  type: string;
  sample?: unknown;
  arrayLength?: number;
}

interface MockDataWithUi extends MockData {
  ui?: {
    consumers?: Array<{ fieldPath: string; component?: string }>;
  };
}

const DEFAULT_MAX_PATHS = 25;
const DEFAULT_MAX_DEPTH = 8;
const MAX_STRING_SAMPLE = 120;
const MAX_OBSERVED_VALUES = 8;

const SEMANTIC_KEY_SUFFIXES = [
  'status',
  'state',
  'code',
  'message',
  'error',
  'type',
  'name',
  'title',
  'total',
  'count',
  'hasmore',
  'success',
  'enabled',
  'active',
  'level',
  'severity',
];

const NOISE_KEY_SUFFIXES = [
  'id',
  '_id',
  'uuid',
  'guid',
  'createdat',
  'updatedat',
  'modifiedat',
  'timestamp',
  'traceid',
  'requestid',
  'correlationid',
  'etag',
  'href',
  'self',
  'checksum',
  'hash',
];

const DENYLIST_SEGMENTS = new Set([
  'id',
  '_id',
  'uuid',
  'guid',
  'createdat',
  'updatedat',
  'modifiedat',
  'timestamp',
  'traceid',
  'requestid',
  'correlationid',
  'etag',
  'href',
  'self',
  'checksum',
  'hash',
  'debug',
  'internal',
  'audit',
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

/** Stable endpoint key for grouping mocks (method + origin + pathname). */
export function getMockEndpointKey(mock: MockData): string {
  const method = (mock.request?.method || 'GET').toUpperCase();
  const url = mock.request?.url || '';
  try {
    const parsed = new URL(url);
    return `${method}:${parsed.origin}${parsed.pathname}`;
  } catch {
    return `${method}:${url.split('?')[0]}`;
  }
}

/** Normalize array indices to wildcard segments (`orders.0.status` → `orders.*.status`). */
export function normalizeAiFieldPath(path: string): string {
  return path
    .split('.')
    .map((segment) => (/^\d+$/.test(segment) ? '*' : segment))
    .join('.');
}

function truncateSample(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length <= MAX_STRING_SAMPLE) return value;
    return `${value.slice(0, MAX_STRING_SAMPLE)}…`;
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? [truncateSample(value[0])] : [];
  }
  return value;
}

function getPathLeaf(path: string): string {
  const parts = path.split('.');
  const last = parts[parts.length - 1] ?? '';
  return last === '*' && parts.length > 1 ? parts[parts.length - 2]! : last;
}

function isNoiseSample(value: unknown): boolean {
  if (typeof value === 'string') {
    if (value.length > 200) return true;
    if (UUID_RE.test(value)) return true;
    if (ISO_DATE_RE.test(value)) return true;
  }
  return false;
}

function walkResponseData(
  value: unknown,
  pathPrefix: string,
  depth: number,
  maxDepth: number,
  out: Map<string, PathWalkInfo>
): void {
  if (depth > maxDepth) return;

  if (value === null || value === undefined) {
    if (pathPrefix) {
      out.set(pathPrefix, { path: pathPrefix, type: 'null', sample: null });
    }
    return;
  }

  if (Array.isArray(value)) {
    const arrayPath = pathPrefix ? `${pathPrefix}.*` : '*';
    if (pathPrefix) {
      out.set(pathPrefix, {
        path: pathPrefix,
        type: 'array',
        sample: value.length > 0 ? truncateSample(value[0]) : [],
        arrayLength: value.length,
      });
    }
    if (value.length > 0) {
      walkResponseData(value[0], arrayPath, depth + 1, maxDepth, out);
    }
    return;
  }

  if (typeof value === 'object') {
    if (pathPrefix && !out.has(pathPrefix)) {
      out.set(pathPrefix, { path: pathPrefix, type: 'object', sample: undefined });
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      walkResponseData(child, childPath, depth + 1, maxDepth, out);
    }
    return;
  }

  if (pathPrefix) {
    out.set(pathPrefix, {
      path: pathPrefix,
      type: typeof value,
      sample: truncateSample(value),
    });
  }
}

function collectConsumerPaths(mock: MockDataWithUi): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const consumer of mock.ui?.consumers ?? []) {
    const normalized = normalizeAiFieldPath(consumer.fieldPath);
    const components = map.get(normalized) ?? new Set<string>();
    if (consumer.component) components.add(consumer.component);
    map.set(normalized, components);
  }
  return map;
}

function collectCrossRecordingValues(
  mocks: MockData[],
  pathInfos: Map<string, PathWalkInfo>
): Map<string, Set<unknown>> {
  const valuesByPath = new Map<string, Set<unknown>>();

  for (const mock of mocks) {
    const data = mock.response?.data;
    if (data === undefined) continue;

    for (const path of pathInfos.keys()) {
      const values = extractValuesAtPath(data, path);
      if (values.length === 0) continue;
      const set = valuesByPath.get(path) ?? new Set<unknown>();
      for (const v of values.slice(0, 3)) {
        set.add(stableValueKey(v));
      }
      valuesByPath.set(path, set);
    }
  }

  return valuesByPath;
}

function stableValueKey(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return value;
}

function extractValuesAtPath(root: unknown, normalizedPath: string): unknown[] {
  const segments = normalizedPath.split('.').filter(Boolean);
  if (segments.length === 0) return [];

  function walk(current: unknown, index: number): unknown[] {
    if (current === null || current === undefined) return [];
    if (index >= segments.length) return [truncateSample(current)];

    const segment = segments[index]!;
    if (segment === '*') {
      if (!Array.isArray(current)) return [];
      if (current.length === 0) return [];
      return walk(current[0], index + 1);
    }

    if (typeof current !== 'object') return [];
    if (Array.isArray(current)) {
      const idx = Number(segment);
      if (!Number.isInteger(idx)) return [];
      return walk(current[idx], index + 1);
    }

    return walk((current as Record<string, unknown>)[segment], index + 1);
  }

  const value = walk(root, 0);
  return value.length > 0 ? value : [];
}

function scorePath(
  path: string,
  info: PathWalkInfo,
  consumerPaths: Map<string, Set<string>>,
  crossValues: Map<string, Set<unknown>>,
  status: number
): ScoredAiPath {
  let score = 0;
  const reasons: string[] = [];
  const leaf = getPathLeaf(path).toLowerCase();

  const consumerComponents = consumerPaths.get(path);
  if (consumerComponents && consumerComponents.size > 0) {
    score += 10 + consumerComponents.size * 2;
    reasons.push(`Used by ${[...consumerComponents].slice(0, 3).join(', ')}`);
  } else {
    for (const [consumerPath, components] of consumerPaths.entries()) {
      if (path.startsWith(`${consumerPath}.`) || consumerPath.startsWith(`${path}.`)) {
        score += 5;
        reasons.push(`Near consumer path (${[...components][0]})`);
        break;
      }
    }
  }

  if (SEMANTIC_KEY_SUFFIXES.some((k) => leaf === k || leaf.endsWith(k))) {
    score += 4;
    reasons.push('Semantic field name');
  }

  if (NOISE_KEY_SUFFIXES.some((k) => leaf === k || leaf.endsWith(k))) {
    score -= 3;
    reasons.push('Common metadata field');
  }

  if (DENYLIST_SEGMENTS.has(leaf)) {
    score -= 4;
    reasons.push('Denylist segment');
  }

  if (info.type === 'boolean') {
    score += 6;
    reasons.push('Boolean flag');
  }

  if (info.type === 'number') {
    if (/(count|total|length|size|amount|qty)/i.test(leaf)) {
      score += 5;
      reasons.push('Numeric count/total');
    }
  }

  if (info.type === 'string' && info.sample !== undefined && !isNoiseSample(info.sample)) {
    score += 2;
  }

  if (info.sample !== undefined && isNoiseSample(info.sample)) {
    score -= 5;
    reasons.push('Noisy sample value');
  }

  const observed = crossValues.get(path);
  if (observed) {
    const count = observed.size;
    if (count >= 2 && count <= 10) {
      score += 7;
      reasons.push(`Varies across recordings (${count} values)`);
    } else if (count > 10) {
      score -= 2;
      reasons.push('Highly unique values');
    }
  }

  if (typeof info.arrayLength === 'number') {
    if (info.arrayLength === 0) {
      score += 4;
      reasons.push('Empty array (state hint)');
    }
  }

  if (status >= 400) {
    if (/(error|message|code|errors)/i.test(path)) {
      score += 8;
      reasons.push('Error response field');
    }
  }

  return {
    path,
    score,
    reasons: [...new Set(reasons)],
    sampleValue: info.sample,
  };
}

function buildSchemaForPaths(
  pathInfos: Map<string, PathWalkInfo>,
  crossValues: Map<string, Set<unknown>>
): Record<string, AiFieldSchemaInfo> {
  const schema: Record<string, AiFieldSchemaInfo> = {};

  for (const [path, info] of pathInfos.entries()) {
    const entry: AiFieldSchemaInfo = { type: info.type };
    if (info.type === 'null') entry.nullable = true;

    const observed = crossValues.get(path);
    if (observed && observed.size > 0 && observed.size <= 12) {
      entry.enum = [...observed].slice(0, MAX_OBSERVED_VALUES).map((key) => {
        try {
          return JSON.parse(String(key));
        } catch {
          return key;
        }
      });
    }

    schema[path] = entry;
  }

  return schema;
}

function pickSelectedPaths(
  scored: ScoredAiPath[],
  options: AiContextOptions
): string[] {
  const exclude = new Set((options.excludePaths ?? []).map(normalizeAiFieldPath));
  const explicit = (options.includePaths ?? []).map(normalizeAiFieldPath);
  const maxPaths = options.maxPaths ?? DEFAULT_MAX_PATHS;

  const auto = scored
    .filter((s) => s.score > 0 && !exclude.has(s.path))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .map((s) => s.path);

  const merged: string[] = [];
  const seen = new Set<string>();

  for (const path of [...explicit, ...auto]) {
    if (exclude.has(path) || seen.has(path)) continue;
    seen.add(path);
    merged.push(path);
    if (merged.length >= maxPaths) break;
  }

  return merged;
}

function buildStateHints(
  selectedPaths: string[],
  crossValues: Map<string, Set<unknown>>,
  pathInfos: Map<string, PathWalkInfo>
): AiStateHint[] {
  const hints: AiStateHint[] = [];

  for (const path of selectedPaths) {
    const observed = crossValues.get(path);
    if (observed && observed.size >= 2) {
      hints.push({
        path,
        observed: [...observed].slice(0, MAX_OBSERVED_VALUES).map((key) => {
          try {
            return JSON.parse(String(key));
          } catch {
            return key;
          }
        }),
      });
      continue;
    }

    const info = pathInfos.get(path);
    if (info?.type === 'array' && typeof info.arrayLength === 'number') {
      hints.push({ path: `${path}.length`, observed: [info.arrayLength] });
    }
  }

  return hints;
}

function buildFieldValues(primary: MockData, paths: string[]): Record<string, unknown> {
  const data = primary.response?.data;
  const fields: Record<string, unknown> = {};
  if (data === undefined) return fields;

  for (const path of paths) {
    const values = extractValuesAtPath(data, path);
    if (values.length === 0) continue;
    fields[path] = values.length === 1 ? values[0] : values;
  }

  return fields;
}

function countOmittedPaths(pathInfos: Map<string, PathWalkInfo>, selected: Set<string>): number {
  let omitted = 0;
  for (const path of pathInfos.keys()) {
    if (!selected.has(path)) omitted += 1;
  }
  return omitted;
}

/**
 * Build a lightweight AI/MCP-friendly projection of mock response data.
 */
export function buildAiContext(
  primaryMock: MockData,
  relatedMocks: MockData[] = [],
  options: AiContextOptions = {}
): AiContextResult {
  const mode = options.mode ?? 'profile';
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const method = (primaryMock.request?.method || 'GET').toUpperCase();
  const url = primaryMock.request?.url || '';
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
  }

  const status = primaryMock.response?.status ?? 200;
  const allMocks = [primaryMock, ...relatedMocks.filter((m) => m !== primaryMock)];

  if (mode === 'full') {
    const fullBytes = Buffer.byteLength(JSON.stringify(primaryMock.response?.data ?? null));
    return {
      endpoint: { method, url, pathname },
      status,
      mode,
      profile: { fields: {}, schema: {}, stateHints: [] },
      discovery: {
        sources: ['full'],
        includedPaths: 0,
        omittedPaths: 0,
        omittedBytes: 0,
        mode,
      },
      data: primaryMock,
    };
  }

  const pathInfos = new Map<string, PathWalkInfo>();
  walkResponseData(primaryMock.response?.data, '', 0, maxDepth, pathInfos);

  const consumerPaths = collectConsumerPaths(primaryMock as MockDataWithUi);
  const crossValues = collectCrossRecordingValues(allMocks, pathInfos);

  const scored = [...pathInfos.entries()]
    .map(([path, info]) => scorePath(path, info, consumerPaths, crossValues, status))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  const sources: string[] = ['schema', 'heuristics'];
  if (consumerPaths.size > 0) sources.push('consumers');
  if (allMocks.length > 1) sources.push('cross-recording-diff');

  if (mode === 'suggest') {
    return {
      endpoint: { method, url, pathname },
      status,
      mode,
      profile: { fields: {}, schema: {}, stateHints: [] },
      suggestions: scored.slice(0, options.maxPaths ?? DEFAULT_MAX_PATHS * 2),
      discovery: {
        sources,
        includedPaths: 0,
        omittedPaths: pathInfos.size,
        omittedBytes: Buffer.byteLength(JSON.stringify(primaryMock.response?.data ?? null)),
        mode,
      },
    };
  }

  const selectedPaths =
    mode === 'schema'
      ? pickSelectedPaths(scored, { ...options, maxPaths: options.maxPaths ?? DEFAULT_MAX_PATHS })
      : pickSelectedPaths(scored, options);

  const selectedSet = new Set(selectedPaths);
  const schema = buildSchemaForPaths(
    new Map([...pathInfos.entries()].filter(([p]) => selectedSet.has(p))),
    crossValues
  );

  const profile: AiContextProfile = {
    fields: mode === 'schema' ? {} : buildFieldValues(primaryMock, selectedPaths),
    schema,
    stateHints: buildStateHints(selectedPaths, crossValues, pathInfos),
  };

  const fullBytes = Buffer.byteLength(JSON.stringify(primaryMock.response?.data ?? null));
  const projectedBytes = Buffer.byteLength(JSON.stringify(profile));

  return {
    endpoint: { method, url, pathname },
    status,
    mode,
    profile,
    discovery: {
      sources,
      includedPaths: selectedPaths.length,
      omittedPaths: countOmittedPaths(pathInfos, selectedSet),
      omittedBytes: Math.max(0, fullBytes - projectedBytes),
      mode,
    },
  };
}
