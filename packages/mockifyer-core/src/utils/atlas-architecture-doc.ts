/**
 * Enhanced Architecture documentation generator for Atlas.
 * Creates a polished, developer-friendly architecture document.
 */

import type { NetworkEvent } from './network-event-types';
import type { EndpointInventory, EndpointInventoryItem } from './atlas-endpoint-inventory';
import { buildEndpointInventory } from './atlas-endpoint-inventory';
import type { ScannedEndpoint } from './atlas-code-scanner';
import { normalizeUrlToTemplate } from './atlas-url-normalizer';

export interface ArchitectureDocOptions {
  networkEvents: NetworkEvent[];
  scannedEndpoints?: ScannedEndpoint[];
  projectRoot?: string;
}

export interface ArchitectureDoc {
  overview: {
    summary: string;
    totalEndpoints: number;
    observedEndpoints: number;
    codeOnlyEndpoints: number;
    unresolvedEndpoints: number;
    totalRequests: number;
    avgResponseTime: number;
    errorRate: number;
  };
  hostSummaries: Array<{
    host: string;
    totalEndpoints: number;
    exercisedEndpoints: number;
    coveragePercent: number;
    avgResponseTime?: number;
    errorRate?: number;
  }>;
  endpoints: Array<{
    host: string;
    method: string;
    urlTemplate: string;
    status: 'observed' | 'code-only' | 'unresolved';
    callCount: number;
    avgDurationMs?: number;
    errorRate?: number;
    codeLocations: Array<{ file: string; line: number; component?: string }>;
  }>;
  keyFlows: Array<{
    name: string;
    rootEndpoint: string;
    depth: number;
    hops: Array<{ method: string; url: string; duration?: number }>;
  }>;
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    category: 'slow' | 'failing' | 'never-exercised' | 'unresolved';
    message: string;
    endpoint?: string;
    count?: number;
  }>;
}

/**
 * Generate architecture documentation from network events and code scan.
 */
export function generateArchitectureDoc(options: ArchitectureDocOptions): ArchitectureDoc {
  const { networkEvents, scannedEndpoints = [] } = options;

  // Build unified endpoint inventory
  const inventory = buildEndpointInventory(networkEvents, scannedEndpoints);

  // Calculate overview stats
  const totalRequests = networkEvents.length;
  const durations = networkEvents
    .map(e => e.durationMs)
    .filter((d): d is number => d !== undefined);
  const avgResponseTime = durations.length > 0 
    ? durations.reduce((a, b) => a + b, 0) / durations.length 
    : 0;
  const errors = networkEvents.filter(e => e.errorMessage || e.source === 'error' || (e.status && e.status >= 400)).length;
  const errorRate = totalRequests > 0 ? errors / totalRequests : 0;

  // Detect key flows (chains with multiple hops)
  const keyFlows = detectKeyFlows(networkEvents);

  // Identify issues
  const issues = identifyIssues(inventory, networkEvents);

  // Host summaries
  const hostSummaries = inventory.summary.hostCoverage.map(coverage => {
    const hostEndpoints = inventory.byHost.get(coverage.host) || [];
    const hostEvents = networkEvents.filter(e => e.url && extractHost(e.url) === coverage.host);
    const hostDurations = hostEvents
      .map(e => e.durationMs)
      .filter((d): d is number => d !== undefined);
    const hostErrors = hostEvents.filter(e => e.errorMessage || e.source === 'error' || (e.status && e.status >= 400)).length;

    return {
      host: coverage.host,
      totalEndpoints: coverage.total,
      exercisedEndpoints: coverage.exercised,
      coveragePercent: coverage.coveragePercent,
      avgResponseTime: hostDurations.length > 0
        ? hostDurations.reduce((a, b) => a + b, 0) / hostDurations.length
        : undefined,
      errorRate: hostEvents.length > 0 ? hostErrors / hostEvents.length : undefined
    };
  });

  // Simplified endpoint list
  const endpoints = inventory.all.map(item => ({
    host: item.host,
    method: item.method,
    urlTemplate: item.urlTemplate,
    status: item.status.startsWith('observed') ? 'observed' as const :
      item.status === 'code-only' ? 'code-only' as const : 'unresolved' as const,
    callCount: item.callCount,
    avgDurationMs: item.avgDurationMs,
    errorRate: item.errorRate,
    codeLocations: item.codeLocations.map(loc => ({
      file: loc.filePath,
      line: loc.line,
      component: loc.component
    }))
  }));

  return {
    overview: {
      summary: `Application with ${inventory.summary.totalEndpoints} endpoints across ${inventory.byHost.size} hosts`,
      totalEndpoints: inventory.summary.totalEndpoints,
      observedEndpoints: inventory.summary.observedCount,
      codeOnlyEndpoints: inventory.summary.codeOnlyCount,
      unresolvedEndpoints: inventory.summary.unresolvedCount,
      totalRequests,
      avgResponseTime: Math.round(avgResponseTime),
      errorRate: Math.round(errorRate * 100) / 100
    },
    hostSummaries,
    endpoints,
    keyFlows,
    issues
  };
}

function extractHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    const match = url.match(/^https?:\/\/([^\/]+)/);
    return match ? match[1] : 'unknown';
  }
}

function detectKeyFlows(events: NetworkEvent[]): Array<{
  name: string;
  rootEndpoint: string;
  depth: number;
  hops: Array<{ method: string; url: string; duration?: number }>;
}> {
  // Build parent-child relationships
  const childrenMap = new Map<string, NetworkEvent[]>();
  for (const event of events) {
    if (event.parentRequestId) {
      if (!childrenMap.has(event.parentRequestId)) {
        childrenMap.set(event.parentRequestId, []);
      }
      childrenMap.get(event.parentRequestId)!.push(event);
    }
  }

  // Find root events (no parent) that have children
  const roots = events.filter(e => !e.parentRequestId && childrenMap.has(e.requestId || ''));

  // Build flow for each root
  const flows = roots.slice(0, 5).map((root, index) => {
    const hops: Array<{ method: string; url: string; duration?: number }> = [];
    let maxDepth = 0;

    function traverse(event: NetworkEvent, depth: number) {
      maxDepth = Math.max(maxDepth, depth);
      hops.push({
        method: event.method || 'GET',
        url: event.url || 'unknown',
        duration: event.durationMs
      });

      const children = childrenMap.get(event.requestId || '') || [];
      for (const child of children) {
        traverse(child, depth + 1);
      }
    }

    traverse(root, 0);

    const rootUrl = root.url || 'unknown';
    const template = normalizeUrlToTemplate(rootUrl).template;

    return {
      name: `Flow ${index + 1}`,
      rootEndpoint: `${root.method} ${template}`,
      depth: maxDepth,
      hops
    };
  });

  return flows.filter(f => f.depth > 0); // Only flows with actual depth
}

function identifyIssues(
  inventory: EndpointInventory,
  events: NetworkEvent[]
): Array<{
  severity: 'error' | 'warning' | 'info';
  category: 'slow' | 'failing' | 'never-exercised' | 'unresolved';
  message: string;
  endpoint?: string;
  count?: number;
}> {
  const issues: Array<{
    severity: 'error' | 'warning' | 'info';
    category: 'slow' | 'failing' | 'never-exercised' | 'unresolved';
    message: string;
    endpoint?: string;
    count?: number;
  }> = [];

  // Slow endpoints
  for (const item of inventory.all) {
    if (item.avgDurationMs && item.avgDurationMs > 1000) {
      issues.push({
        severity: 'warning',
        category: 'slow',
        message: `Slow endpoint: avg ${Math.round(item.avgDurationMs)}ms`,
        endpoint: `${item.method} ${item.urlTemplate}`
      });
    }
  }

  // Failing endpoints
  for (const item of inventory.all) {
    if (item.errorRate && item.errorRate > 0.1) {
      issues.push({
        severity: 'error',
        category: 'failing',
        message: `High error rate: ${Math.round(item.errorRate * 100)}%`,
        endpoint: `${item.method} ${item.urlTemplate}`,
        count: Math.round(item.callCount * item.errorRate)
      });
    }
  }

  // Never exercised
  const neverExercised = inventory.all.filter(item => item.status === 'code-only');
  if (neverExercised.length > 0) {
    issues.push({
      severity: 'info',
      category: 'never-exercised',
      message: `${neverExercised.length} endpoints found in code but never observed`,
      count: neverExercised.length
    });
  }

  // Unresolved
  const unresolved = inventory.all.filter(item => item.status === 'unresolved');
  if (unresolved.length > 0) {
    issues.push({
      severity: 'info',
      category: 'unresolved',
      message: `${unresolved.length} endpoint calls with unresolvable URLs`,
      count: unresolved.length
    });
  }

  return issues.sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}
