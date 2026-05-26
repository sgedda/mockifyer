import { endpointUrlToDomainPath } from '@sgedda/mockifyer-core';

/**
 * Matches mock endpoint URLs to domain-tree `fullPath` keys
 * (host/path segments as built by {@link buildMockRequestTree}).
 */
export function endpointMatchesDomainPath(endpoint: string | null | undefined, domainPath: string): boolean {
  if (!endpoint || !domainPath.trim()) return false;
  const full = endpointUrlToDomainPath(endpoint);
  if (!full) return false;
  const prefix = domainPath.trim().replace(/^\/+|\/+$/g, '');
  return full === prefix || full.startsWith(`${prefix}/`);
}

export type LiveApiAggregate = 'all_live' | 'all_mock' | 'mixed' | 'empty';

export interface LiveApiCounts {
  total: number;
  live: number;
  pending: number;
}

function hasLiveReplayMode(m: {
  alwaysUseRealApi?: boolean;
  refreshOnNextRequest?: boolean;
  alwaysRefreshFromLive?: boolean;
  responsePending?: boolean;
  replayMode?: string | null;
}): boolean {
  if (m.responsePending === true || m.alwaysUseRealApi === true) return true;
  if (m.replayMode && m.replayMode !== 'stored') return true;
  return m.refreshOnNextRequest === true || m.alwaysRefreshFromLive === true;
}

export function countLiveApiInMocks(
  mocks: Array<{
    endpoint?: string | null;
    alwaysUseRealApi?: boolean;
    refreshOnNextRequest?: boolean;
    alwaysRefreshFromLive?: boolean;
    responsePending?: boolean;
    replayMode?: string | null;
  }>,
  domainPath: string
): LiveApiCounts {
  const counts: LiveApiCounts = { total: 0, live: 0, pending: 0 };
  for (const m of mocks) {
    if (!endpointMatchesDomainPath(m.endpoint ?? null, domainPath)) continue;
    counts.total += 1;
    if (m.responsePending === true) counts.pending += 1;
    if (hasLiveReplayMode(m)) counts.live += 1;
  }
  return counts;
}

export function aggregateLiveApiState(counts: Pick<LiveApiCounts, 'total' | 'live'>): LiveApiAggregate {
  if (counts.total === 0) return 'empty';
  if (counts.live === 0) return 'all_mock';
  if (counts.live === counts.total) return 'all_live';
  return 'mixed';
}
