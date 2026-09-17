import type { MockData } from '@sgedda/mockifyer-core';

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

export function toRankedResponseStat(params: {
  filename: string;
  mockData: MockData;
  size: number;
}): RankedResponseStat {
  const { filename, mockData, size } = params;
  const method = String(mockData.request?.method || 'GET').toUpperCase();
  const endpoint = mockData.request?.url || filename;
  return {
    filename,
    endpoint,
    method,
    operationName: readGraphqlOperationName(mockData),
    durationMs: readMockDurationMs(mockData),
    size,
    requestId: trimId(mockData.requestId),
    parentRequestId: trimId(mockData.parentRequestId),
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
