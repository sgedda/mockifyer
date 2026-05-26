import type { ScenarioResolutionSource } from './redis-mock-store';

export type ClientConnectionStatus = 'connected' | 'mapped_idle' | 'unmapped';

export interface ClientLaneLastSeenResolved {
  scenario: string;
  lastSeenAt: string;
  resolutionSource?: ScenarioResolutionSource;
  clientBodyScenarioOverride?: boolean;
}

export interface ClientLaneSummary {
  clientId: string;
  scenario: string;
  note: string | null;
  lastSeenResolved?: ClientLaneLastSeenResolved | null;
  devices?: { count: number };
}

export interface ClientConnectionRow {
  clientId: string;
  configuredScenario: string | null;
  lastResolvedScenario: string | null;
  lastSeenAt: string | null;
  lastResolvedAt: string | null;
  deviceCount: number;
  note: string | null;
  status: ClientConnectionStatus;
}

/**
 * Merge configured lanes and recently discovered client ids into a dashboard row list.
 */
export function buildClientConnectionRows(
  lanes: ClientLaneSummary[],
  discovered: Array<{ clientId: string; lastSeenMs: number }>
): ClientConnectionRow[] {
  const laneById = new Map(lanes.map((l) => [l.clientId, l]));
  const discoveredById = new Map(discovered.map((d) => [d.clientId, d]));
  const allIds = new Set<string>([...laneById.keys(), ...discoveredById.keys()]);

  const rows: ClientConnectionRow[] = [];
  for (const clientId of [...allIds].sort((a, b) => a.localeCompare(b))) {
    const lane = laneById.get(clientId);
    const seen = discoveredById.get(clientId);
    const lastSeenAt = seen ? new Date(seen.lastSeenMs).toISOString() : null;
    const lastResolved = lane?.lastSeenResolved ?? null;

    if (!lane) {
      rows.push({
        clientId,
        configuredScenario: null,
        lastResolvedScenario: null,
        lastSeenAt,
        lastResolvedAt: null,
        deviceCount: 0,
        note: null,
        status: 'unmapped',
      });
      continue;
    }

    const hasRecentActivity = Boolean(seen || lastResolved);
    rows.push({
      clientId,
      configuredScenario: lane.scenario,
      lastResolvedScenario: lastResolved?.scenario ?? null,
      lastSeenAt: lastSeenAt ?? lastResolved?.lastSeenAt ?? null,
      lastResolvedAt: lastResolved?.lastSeenAt ?? null,
      deviceCount: lane.devices?.count ?? 0,
      note: lane.note,
      status: hasRecentActivity ? 'connected' : 'mapped_idle',
    });
  }

  return rows.sort((a, b) => {
    const rank = (s: ClientConnectionStatus) =>
      s === 'unmapped' ? 0 : s === 'connected' ? 1 : 2;
    const dr = rank(a.status) - rank(b.status);
    if (dr !== 0) return dr;
    const aTs = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
    const bTs = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
    return bTs - aTs;
  });
}
