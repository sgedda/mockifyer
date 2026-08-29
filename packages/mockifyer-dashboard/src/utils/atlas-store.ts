import {
  buildAtlasTree,
  clearAtlasDocMap,
  getAtlasDocMap,
  mergeUsageOntoNetworkEvents,
  upsertAtlasDocFromPrefetch,
  upsertAtlasDocFromPresentation,
  upsertAtlasDocFromUsage,
  type AtlasDocMap,
  type AtlasEvent,
  type AtlasPrefetchEvent,
  type AtlasPresentationEvent,
  type AtlasTreeNode,
  type AtlasUsageAnnotation,
  type NetworkEventUsage,
} from '@sgedda/mockifyer-core';
import { newRequestId } from './network-log-store';

const DEFAULT_MAX_EVENTS = 2_000;

function maxEvents(): number {
  const n = Number.parseInt(process.env.MOCKIFYER_ATLAS_MAX_EVENTS ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_EVENTS;
}

export interface AtlasListOptions {
  scenario: string;
  sessionId?: string;
  clientId?: string;
  limit?: number;
  kind?: 'prefetch' | 'presentation';
}

export interface AtlasStore {
  append(scenario: string, event: AtlasEvent): AtlasEvent;
  appendUsage(scenario: string, annotation: AtlasUsageAnnotation): AtlasUsageAnnotation;
  list(options: AtlasListOptions): { events: AtlasEvent[]; ephemeral: boolean };
  listUsage(scenario: string): AtlasUsageAnnotation[];
  listSessions(scenario: string): string[];
  getTree(scenario: string, sessionId: string): AtlasTreeNode[];
  getDoc(scenario: string): AtlasDocMap;
  clearDoc(scenario: string): void;
  clear(options: { scenario: string; sessionId?: string }): number;
}

function ensureEventIds(event: AtlasEvent): AtlasEvent {
  if (event.id && event.timestamp) return event;
  return {
    ...event,
    id: event.id || newRequestId(),
    timestamp: event.timestamp || new Date().toISOString(),
  };
}

function upsertDocFromEvent(scenario: string, event: AtlasEvent): void {
  if (event.kind === 'prefetch') {
    upsertAtlasDocFromPrefetch({
      scenario,
      datasourceId: event.datasourceId,
      kind: event.datasourceKind,
      operation: event.operation,
      phase: event.phase,
      timestamp: event.timestamp,
    });
    return;
  }
  upsertAtlasDocFromPresentation({
    scenario,
    timestamp: event.timestamp,
    cms: event.cms,
    datasources: event.datasources,
    shown: event.shown,
  });
}

class MemoryAtlasStore implements AtlasStore {
  private readonly buffers = new Map<string, AtlasEvent[]>();
  private readonly usageBuffers = new Map<string, AtlasUsageAnnotation[]>();
  private readonly max = maxEvents();

  private key(scenario: string): string {
    return scenario.trim() || 'default';
  }

  append(scenario: string, event: AtlasEvent): AtlasEvent {
    const key = this.key(scenario);
    const normalized = ensureEventIds({ ...event, scenario: key });
    const buf = this.buffers.get(key) ?? [];
    buf.unshift(normalized);
    if (buf.length > this.max) {
      buf.length = this.max;
    }
    this.buffers.set(key, buf);
    upsertDocFromEvent(key, normalized);
    return normalized;
  }

  appendUsage(scenario: string, annotation: AtlasUsageAnnotation): AtlasUsageAnnotation {
    const key = this.key(scenario);
    const normalized: AtlasUsageAnnotation = {
      ...annotation,
      id: annotation.id || newRequestId(),
      timestamp: annotation.timestamp || new Date().toISOString(),
      scenario: key,
    };
    const buf = this.usageBuffers.get(key) ?? [];
    buf.unshift(normalized);
    if (buf.length > this.max) {
      buf.length = this.max;
    }
    this.usageBuffers.set(key, buf);
    upsertAtlasDocFromUsage({
      scenario: key,
      screen: normalized.usage.screen,
      component: normalized.usage.component,
      datasourceId: normalized.usage.datasourceId,
      cms: normalized.usage.cms,
      timestamp: normalized.timestamp,
    });
    return normalized;
  }

  list(options: AtlasListOptions): { events: AtlasEvent[]; ephemeral: boolean } {
    const key = this.key(options.scenario);
    let events = [...(this.buffers.get(key) ?? [])];
    if (options.sessionId?.trim()) {
      const sid = options.sessionId.trim();
      events = events.filter((e) => e.sessionId === sid);
    }
    if (options.clientId?.trim()) {
      const lane = options.clientId.trim();
      events = events.filter((e) => (e.clientId ?? '') === lane);
    }
    if (options.kind) {
      events = events.filter((e) => e.kind === options.kind);
    }
    const limit = Math.min(Math.max(options.limit ?? 500, 1), this.max);
    return { events: events.slice(0, limit), ephemeral: true };
  }

  listUsage(scenario: string): AtlasUsageAnnotation[] {
    return [...(this.usageBuffers.get(this.key(scenario)) ?? [])];
  }

  listSessions(scenario: string): string[] {
    const { events } = this.list({ scenario, limit: this.max });
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const e of events) {
      if (!seen.has(e.sessionId)) {
        seen.add(e.sessionId);
        ordered.push(e.sessionId);
      }
    }
    for (const u of this.listUsage(scenario)) {
      const sid = u.sessionId?.trim();
      if (sid && !seen.has(sid)) {
        seen.add(sid);
        ordered.push(sid);
      }
    }
    return ordered;
  }

  getTree(scenario: string, sessionId: string): AtlasTreeNode[] {
    const { events } = this.list({ scenario, sessionId, limit: this.max });
    return buildAtlasTree(events, sessionId);
  }

  getDoc(scenario: string): AtlasDocMap {
    return getAtlasDocMap(this.key(scenario));
  }

  clearDoc(scenario: string): void {
    clearAtlasDocMap(this.key(scenario));
  }

  clear(options: { scenario: string; sessionId?: string }): number {
    const key = this.key(options.scenario);
    const buf = this.buffers.get(key) ?? [];
    const usageBuf = this.usageBuffers.get(key) ?? [];
    if (!options.sessionId?.trim()) {
      const n = buf.length + usageBuf.length;
      this.buffers.set(key, []);
      this.usageBuffers.set(key, []);
      return n;
    }
    const sid = options.sessionId.trim();
    const kept = buf.filter((e) => e.sessionId !== sid);
    const usageKept = usageBuf.filter((e) => (e.sessionId ?? '') !== sid);
    const removed = buf.length - kept.length + (usageBuf.length - usageKept.length);
    this.buffers.set(key, kept);
    this.usageBuffers.set(key, usageKept);
    return removed;
  }
}

const globalStore = new MemoryAtlasStore();

export function getAtlasStore(): AtlasStore {
  return globalStore;
}

export function isAtlasPrefetchEvent(event: AtlasEvent): event is AtlasPrefetchEvent {
  return event.kind === 'prefetch';
}

export function isAtlasPresentationEvent(event: AtlasEvent): event is AtlasPresentationEvent {
  return event.kind === 'presentation';
}

export function mergeNetworkEventsWithAtlasUsage<
  T extends { requestId?: string | null; usage?: NetworkEventUsage | NetworkEventUsage[] },
>(scenario: string, events: T[]): T[] {
  const annotations = getAtlasStore().listUsage(scenario);
  return mergeUsageOntoNetworkEvents(events, annotations);
}
