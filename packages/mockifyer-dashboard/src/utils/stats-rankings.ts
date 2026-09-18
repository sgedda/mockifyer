import { resolveMockReplayMode, type MockData } from '@sgedda/mockifyer-core';

/** Same four buckets as hop Replay / Live / Pending / Refresh badges. */
export type StatsTrafficMode = 'replay' | 'refresh' | 'pending' | 'live';

export interface ReplayModeBreakdown {
  replay: number;
  refresh: number;
  pending: number;
  live: number;
}

export function emptyReplayModeBreakdown(): ReplayModeBreakdown {
  return { replay: 0, refresh: 0, pending: 0, live: 0 };
}

/**
 * Pending stubs are counted separately from Live even though both hit upstream.
 * Matches dashboard hop badges (`getMockHopTrafficMode`).
 */
export function statsTrafficMode(mockData: MockData): StatsTrafficMode {
  if (mockData.responsePending === true) return 'pending';
  const mode = resolveMockReplayMode(mockData);
  if (mode === 'stored') return 'replay';
  if (mode === 'always-refresh' || mode === 'refresh-next') return 'refresh';
  return 'live';
}

export function countReplayModes(items: MockData[]): ReplayModeBreakdown {
  const counts = emptyReplayModeBreakdown();
  for (const item of items) {
    counts[statsTrafficMode(item)] += 1;
  }
  return counts;
}

export function addReplayModeCount(counts: ReplayModeBreakdown, mockData: MockData): void {
  counts[statsTrafficMode(mockData)] += 1;
}

export function readEndpointHostname(endpoint: string | null | undefined): string | null {
  if (!endpoint?.trim()) return null;
  try {
    const hostname = new URL(endpoint).hostname.trim();
    return hostname || null;
  } catch {
    return null;
  }
}

export function matchesStatsDomain(
  endpoint: string | null | undefined,
  domain: string | null | undefined
): boolean {
  const wanted = domain?.trim();
  if (!wanted) return true;
  return readEndpointHostname(endpoint) === wanted;
}

export function filterByStatsDomain<T extends { endpoint: string }>(
  items: T[],
  domain: string | null | undefined
): T[] {
  const wanted = domain?.trim();
  if (!wanted) return items;
  return items.filter((item) => matchesStatsDomain(item.endpoint, wanted));
}

export const STATS_TOP_RESPONSES = 10;

export interface RankedResponseStat {
  filename: string;
  endpoint: string;
  method: string;
  operationName?: string | null;
  durationMs?: number;
  size: number;
  requestId?: string | null;
  parentRequestId?: string | null;
  /** True when no other recording lists this hop as its parent (lowest-level call). */
  isLeaf?: boolean;
  /** Same buckets as hop Replay / Live / Pending / Refresh badges. */
  trafficMode?: StatsTrafficMode;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function trimId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Recorded round-trip time (`duration`, or legacy `responseTime`). */
export function readMockDurationMs(mockData: MockData): number | undefined {
  const record = mockData as MockData & { responseTime?: unknown };
  if (isPositiveNumber(record.duration)) return record.duration;
  if (isPositiveNumber(record.responseTime)) return record.responseTime;
  return undefined;
}

export function readGraphqlOperationName(mockData: MockData): string | null {
  const data = mockData.request?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const name = (data as { operationName?: unknown }).operationName;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

export interface RecentActivityStat {
  filename: string;
  modified: string;
  method: string;
  endpoint: string;
  operationName?: string | null;
}

export function toRecentActivityStat(params: {
  filename: string;
  mockData: MockData;
  modified: Date;
}): RecentActivityStat {
  const ranked = toRankedResponseStat({ filename: params.filename, mockData: params.mockData, size: 0 });
  return {
    filename: ranked.filename,
    modified: params.modified.toISOString(),
    method: ranked.method,
    endpoint: ranked.endpoint,
    operationName: ranked.operationName,
  };
}

export function rankRecentActivity(items: RecentActivityStat[], limit = STATS_TOP_RESPONSES): RecentActivityStat[] {
  return [...items]
    .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
    .slice(0, limit);
}

export function toRankedResponseStat(params: {
  filename: string;
  mockData: MockData;
  size: number;
}): RankedResponseStat {
  const { filename, mockData, size } = params;
  const method = String(mockData.request?.method || 'GET').toUpperCase();
  const endpoint = mockData.request?.url || '';
  return {
    filename,
    endpoint,
    method,
    operationName: readGraphqlOperationName(mockData),
    durationMs: readMockDurationMs(mockData),
    size,
    requestId: trimId(mockData.requestId),
    parentRequestId: trimId(mockData.parentRequestId),
    trafficMode: statsTrafficMode(mockData),
  };
}

/**
 * A hop is a leaf when nothing else recorded it as `parentRequestId`.
 * Parent hops include nested child time and payload, so rankings should prefer leaves.
 */
export function annotateLeafHops(items: RankedResponseStat[]): RankedResponseStat[] {
  const usedAsParent = new Set<string>();
  for (const item of items) {
    const parentId = trimId(item.parentRequestId);
    if (parentId) usedAsParent.add(parentId);
  }
  return items.map((item) => {
    const id = trimId(item.requestId);
    return {
      ...item,
      isLeaf: !id || !usedAsParent.has(id),
    };
  });
}

export function leafResponses(items: RankedResponseStat[]): RankedResponseStat[] {
  return annotateLeafHops(items).filter((item) => item.isLeaf === true);
}

export function rankSlowestResponses(items: RankedResponseStat[], limit = STATS_TOP_RESPONSES): RankedResponseStat[] {
  return items
    .filter((item) => item.durationMs != null)
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
    .slice(0, limit);
}

export function rankLargestResponses(items: RankedResponseStat[], limit = STATS_TOP_RESPONSES): RankedResponseStat[] {
  return [...items].sort((a, b) => b.size - a.size).slice(0, limit);
}
