/**
 * Unified endpoint inventory for Atlas: merges code scan, traffic capture, and mocks.
 */

import type { NetworkEvent } from './network-event-types';
import type { ScannedEndpoint } from './atlas-code-scanner';
import { normalizeUrlToTemplate, normalizeTemplatePlaceholders } from './atlas-url-normalizer';
import { inferSchemaFromSamples, simplifySchema, type JsonSchema } from './atlas-schema-inference';

export type EndpointStatus = 
  | 'observed-with-chain'  // Captured with downstream trace
  | 'observed-no-chain'    // Captured but no downstream visible
  | 'mocked-only'          // Only in mocks, never observed live
  | 'code-only'            // Found in code but never observed
  | 'unresolved';          // Found in code but URL couldn't be resolved

export interface EndpointObservation {
  requestId?: string;
  timestamp?: string;
  durationMs?: number;
  status?: number;
  errorMessage?: string;
  source?: 'mock-hit' | 'mock-miss' | 'upstream' | 'blocked' | 'error';
  parentRequestId?: string | null;
  childCount?: number;
}

export interface EndpointInventoryItem {
  host: string;
  method: string;
  urlTemplate: string;
  status: EndpointStatus;
  observations: EndpointObservation[];
  codeLocations: Array<{
    filePath: string;
    line: number;
    component?: string;
  }>;
  mockExists: boolean;
  requestSchema?: JsonSchema;
  responseSchema?: JsonSchema;
  avgDurationMs?: number;
  errorRate?: number;
  callCount: number;
}

export interface EndpointInventory {
  byHost: Map<string, EndpointInventoryItem[]>;
  all: EndpointInventoryItem[];
  summary: {
    totalEndpoints: number;
    observedCount: number;
    mockedOnlyCount: number;
    codeOnlyCount: number;
    unresolvedCount: number;
    hostCoverage: Array<{
      host: string;
      total: number;
      exercised: number;
      coveragePercent: number;
    }>;
  };
}

/**
 * Extract host from URL, with fallback for relative URLs.
 */
export function extractHost(url: string, fallbackHost?: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.host;
  } catch {
    // Try to extract from partial URLs
    const match = url.match(/^https?:\/\/([^\/]+)/);
    if (match) return match[1];
    
    // For relative URLs, use fallback or default
    return fallbackHost || 'Same-origin API';
  }
}

/**
 * Build unified endpoint inventory from all sources.
 */
export function buildEndpointInventory(
  networkEvents: NetworkEvent[],
  scannedEndpoints: ScannedEndpoint[],
  mockFiles?: Array<{ method: string; url: string }>
): EndpointInventory {
  const itemsMap = new Map<string, EndpointInventoryItem>();

  // Determine a reasonable fallback host from network events
  // Count host frequencies to pick the most common as fallback for relative paths
  const hostCounts = new Map<string, number>();
  for (const event of networkEvents) {
    if (event.url) {
      try {
        const urlObj = new URL(event.url);
        const host = urlObj.host;
        hostCounts.set(host, (hostCounts.get(host) || 0) + 1);
      } catch {}
    }
  }
  // Pick the most frequently observed host as fallback, or 'Same-origin API' if none observed
  let fallbackHost = 'Same-origin API';
  if (hostCounts.size > 0) {
    let maxCount = 0;
    for (const [host, count] of hostCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        fallbackHost = host;
      }
    }
  }

  // Helper to get or create an inventory item
  function getOrCreate(host: string, method: string, urlTemplate: string): EndpointInventoryItem {
    const key = `${host}::${method}::${urlTemplate}`;
    if (!itemsMap.has(key)) {
      itemsMap.set(key, {
        host,
        method,
        urlTemplate,
        status: 'unresolved',
        observations: [],
        codeLocations: [],
        mockExists: false,
        callCount: 0
      });
    }
    return itemsMap.get(key)!;
  }

  // Process mocks
  if (mockFiles) {
    for (const mock of mockFiles) {
      const host = extractHost(mock.url);
      const normalized = normalizeUrlToTemplate(mock.url);
      const item = getOrCreate(host, mock.method.toUpperCase(), normalized.template);
      item.mockExists = true;
      if (item.status === 'unresolved') {
        item.status = 'mocked-only';
      }
    }
  }

  // Process scanned code
  for (const scanned of scannedEndpoints) {
    // Check if resolvedUrl is an actual full URL (not just a path template like '{param}')
    const isFullUrl = scanned.resolvedUrl && /^https?:\/\//i.test(scanned.resolvedUrl);
    // Check if it's a resolved relative path (starts with /)
    const isRelativePath = scanned.resolvedUrl && scanned.resolvedUrl.startsWith('/') && !scanned.resolvedUrl.startsWith('//');
    let host: string;
    let pathTemplate: string;
    
    if (isFullUrl) {
      // Check for malformed URLs like http://host:port{param}
      const match = scanned.resolvedUrl!.match(/^(https?:\/\/[^\/\{]+)(\{param\})(.*)/);
      if (match) {
        // Split: http://host:port{param} -> host:port and /{param}
        // Normalize {param} to {id} for consistent merging with traffic templates
        host = extractHost(match[1], fallbackHost);
        pathTemplate = normalizeTemplatePlaceholders('/' + match[2] + match[3]);
      } else {
        host = extractHost(scanned.resolvedUrl!, fallbackHost);
        const normalized = normalizeUrlToTemplate(scanned.resolvedUrl!);
        pathTemplate = normalized.template;
      }
    } else if (isRelativePath) {
      // Resolved relative path: use fallbackHost instead of "Unresolved base URL"
      host = fallbackHost;
      const normalized = normalizeUrlToTemplate(scanned.resolvedUrl!);
      pathTemplate = normalized.template;
    } else {
      // Truly unresolved (e.g., '{param}' or other templates)
      host = 'Unresolved base URL';
      if (scanned.resolvedUrl) {
        const normalized = normalizeUrlToTemplate(scanned.resolvedUrl);
        pathTemplate = normalized.template;
      } else {
        // Normalize template placeholders (:id, {param}) to standard format from code scanner
        pathTemplate = normalizeTemplatePlaceholders(scanned.urlTemplate);
      }
    }
    
    // When host is unresolved, try to find an existing endpoint with same method and template
    let item: EndpointInventoryItem | undefined;
    if (host === 'Unresolved base URL') {
      // Search for existing endpoint in any host
      for (const [key, existingItem] of itemsMap.entries()) {
        if (existingItem.method === scanned.method && existingItem.urlTemplate === pathTemplate) {
          item = existingItem;
          break;
        }
      }
    }
    
    // If not found or host is not unresolved, use getOrCreate
    if (!item) {
      item = getOrCreate(host, scanned.method, pathTemplate);
    }
    
    item.codeLocations.push({
      filePath: scanned.filePath,
      line: scanned.line,
      component: scanned.componentName
    });

    // Only update status if currently unresolved
    // Preserve mocked-only and observed statuses even when code is found
    if (item.status === 'unresolved') {
      item.status = scanned.callType === 'unresolved' ? 'unresolved' : 'code-only';
    } else if (item.status === 'code-only' && scanned.callType === 'unresolved') {
      item.status = 'unresolved';
    }
  }

  // Build parent-child map for chain detection
  // Map both id and requestId to the same event so parentRequestId can point to either
  const childCounts = new Map<string, number>();
  const eventIdToRequestId = new Map<string, string>();
  for (const event of networkEvents) {
    if (event.id && event.requestId) {
      eventIdToRequestId.set(event.id, event.requestId);
    }
  }
  for (const event of networkEvents) {
    if (event.parentRequestId) {
      // Increment count for the parentRequestId
      childCounts.set(event.parentRequestId, (childCounts.get(event.parentRequestId) || 0) + 1);
      // Also increment for the corresponding requestId if parentRequestId is an event id
      const correspondingRequestId = eventIdToRequestId.get(event.parentRequestId);
      if (correspondingRequestId && correspondingRequestId !== event.parentRequestId) {
        childCounts.set(correspondingRequestId, (childCounts.get(correspondingRequestId) || 0) + 1);
      }
    }
  }

  // Process network events
  const requestBodies: Record<string, unknown[]> = {};
  const responseBodies: Record<string, unknown[]> = {};

  for (const event of networkEvents) {
    if (!event.url) continue;
    
    const host = extractHost(event.url);
    const normalized = normalizeUrlToTemplate(event.url);
    const method = event.method?.toUpperCase() || 'GET';
    
    // Check if there's an unresolved endpoint with same method/template that we should merge with
    let item: EndpointInventoryItem | undefined;
    const unresolvedKey = `Unresolved base URL::${method}::${normalized.template}`;
    const resolvedKey = `${host}::${method}::${normalized.template}`;
    
    if (itemsMap.has(unresolvedKey)) {
      // Found an unresolved endpoint - need to promote it to resolved host
      const unresolvedItem = itemsMap.get(unresolvedKey)!;
      itemsMap.delete(unresolvedKey);
      
      // Check if there's already a resolved entry at the target key
      if (itemsMap.has(resolvedKey)) {
        // Merge with existing resolved entry instead of overwriting
        item = itemsMap.get(resolvedKey)!;
        // Merge code locations from unresolved entry
        item.codeLocations.push(...unresolvedItem.codeLocations);
        // Preserve mockExists flag if either has it
        item.mockExists = item.mockExists || unresolvedItem.mockExists;
        // Keep the more specific status (observed > code-only > unresolved)
        if (unresolvedItem.status === 'mocked-only' && item.status !== 'observed-with-chain' && item.status !== 'observed-no-chain') {
          item.status = 'mocked-only';
        }
      } else {
        // No existing entry, just move the unresolved one
        unresolvedItem.host = host;
        itemsMap.set(resolvedKey, unresolvedItem);
        item = unresolvedItem;
      }
    } else {
      item = getOrCreate(host, method, normalized.template);
    }

    // Update status
    const hasChain = childCounts.has(event.requestId || '') && (childCounts.get(event.requestId!) || 0) > 0;
    if (hasChain) {
      item.status = 'observed-with-chain';
    } else if (item.status !== 'observed-with-chain') {
      item.status = 'observed-no-chain';
    }

    item.observations.push({
      requestId: event.requestId || undefined,
      timestamp: event.timestamp,
      durationMs: event.durationMs,
      status: event.status,
      errorMessage: event.errorMessage,
      source: event.source,
      parentRequestId: event.parentRequestId,
      childCount: childCounts.get(event.requestId || '') || 0
    });

    item.callCount++;

    // Collect bodies for schema inference
    const key = `${host}::${method}::${normalized.template}`;
    if (event.requestBodyPreview) {
      if (!requestBodies[key]) requestBodies[key] = [];
      try {
        requestBodies[key].push(JSON.parse(event.requestBodyPreview));
      } catch {
        // Ignore non-JSON
      }
    }
    if (event.responseBodyPreview) {
      if (!responseBodies[key]) responseBodies[key] = [];
      try {
        responseBodies[key].push(JSON.parse(event.responseBodyPreview));
      } catch {
        // Ignore non-JSON
      }
    }
  }

  // Infer schemas and calculate stats
  for (const [key, item] of itemsMap.entries()) {
    if (item.observations.length > 0) {
      const durations = item.observations.map(o => o.durationMs).filter((d): d is number => d !== undefined);
      if (durations.length > 0) {
        item.avgDurationMs = durations.reduce((a, b) => a + b, 0) / durations.length;
      }

      const errors = item.observations.filter(o => o.errorMessage || o.source === 'error' || (o.status && o.status >= 400)).length;
      item.errorRate = errors / item.observations.length;
    }

    if (requestBodies[key]?.length) {
      item.requestSchema = simplifySchema(inferSchemaFromSamples(requestBodies[key]));
    }
    if (responseBodies[key]?.length) {
      item.responseSchema = simplifySchema(inferSchemaFromSamples(responseBodies[key]));
    }
  }

  // Count unresolved endpoints BEFORE consolidation to get accurate call site count
  const unresolvedCountBeforeConsolidation = Array.from(itemsMap.values())
    .filter(i => i.host === 'Unresolved base URL').length;

  // Consolidate unresolved endpoints into a single row per host
  const unresolvedByHost = new Map<string, EndpointInventoryItem[]>();
  const keysToRemove: string[] = [];
  
  for (const [key, item] of itemsMap.entries()) {
    if (item.urlTemplate === 'unresolved') {
      if (!unresolvedByHost.has(item.host)) {
        unresolvedByHost.set(item.host, []);
      }
      unresolvedByHost.get(item.host)!.push(item);
      keysToRemove.push(key);
    }
  }
  
  // Remove individual unresolved entries
  for (const key of keysToRemove) {
    itemsMap.delete(key);
  }
  
  // Add consolidated unresolved entries (preserving original count in metadata)
  for (const [host, unresolvedItems] of unresolvedByHost.entries()) {
    if (unresolvedItems.length > 0) {
      // Aggregate all code locations and methods
      const allLocations: Array<{ filePath: string; line: number; component?: string }> = [];
      const methods = new Set<string>();
      
      for (const item of unresolvedItems) {
        methods.add(item.method);
        allLocations.push(...item.codeLocations);
      }
      
      // Create single consolidated entry
      const methodList = Array.from(methods).join('/');
      const key = `${host}::${methodList}::unresolved`;
      itemsMap.set(key, {
        host,
        method: methodList,
        urlTemplate: 'unresolved',
        status: 'unresolved',
        observations: [],
        codeLocations: allLocations,
        mockExists: false,
        callCount: 0
      });
    }
  }

  // Group by host
  const byHost = new Map<string, EndpointInventoryItem[]>();
  const all: EndpointInventoryItem[] = [];

  for (const item of itemsMap.values()) {
    all.push(item);
    if (!byHost.has(item.host)) {
      byHost.set(item.host, []);
    }
    byHost.get(item.host)!.push(item);
  }

  // Sort by host, then method, then template
  for (const items of byHost.values()) {
    items.sort((a, b) => {
      if (a.method !== b.method) return a.method.localeCompare(b.method);
      return a.urlTemplate.localeCompare(b.urlTemplate);
    });
  }

  // Calculate summary
  const observedCount = all.filter(i => i.status.startsWith('observed')).length;
  const mockedOnlyCount = all.filter(i => i.status === 'mocked-only').length;
  const codeOnlyCount = all.filter(i => i.status === 'code-only').length;
  // Use the count from before consolidation to reflect actual number of unresolvable calls
  const unresolvedCount = unresolvedCountBeforeConsolidation;

  const hostCoverage = Array.from(byHost.entries()).map(([host, items]) => {
    const total = items.length;
    const exercised = items.filter(i => i.status.startsWith('observed')).length;
    return {
      host,
      total,
      exercised,
      coveragePercent: total > 0 ? Math.round((exercised / total) * 100) : 0
    };
  }).sort((a, b) => b.exercised - a.exercised);

  return {
    byHost,
    all,
    summary: {
      totalEndpoints: all.length,
      observedCount,
      mockedOnlyCount,
      codeOnlyCount,
      unresolvedCount,
      hostCoverage
    }
  };
}

/**
 * Generate OpenAPI 3.0 specification from endpoint inventory.
 */
export function generateOpenApiSpec(
  inventory: EndpointInventory,
  info: { title: string; version: string; description?: string }
): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  const servers = new Set<string>();

  // Group operations by path and method to detect collisions
  const operationsByPath = new Map<string, Map<string, typeof inventory.all>>();

  for (const item of inventory.all) {
    if (item.status === 'unresolved') continue;

    const hostUrl = item.host !== 'unknown' ? `https://${item.host}` : '';
    if (hostUrl) servers.add(hostUrl);

    const pathKey = item.urlTemplate;
    const methodKey = item.method.toLowerCase();
    
    if (!operationsByPath.has(pathKey)) {
      operationsByPath.set(pathKey, new Map());
    }
    if (!operationsByPath.get(pathKey)!.has(methodKey)) {
      operationsByPath.get(pathKey)!.set(methodKey, []);
    }
    operationsByPath.get(pathKey)!.get(methodKey)!.push(item);
  }

  // Generate paths, handling collisions with x-host extension
  for (const [pathKey, methodOps] of operationsByPath.entries()) {
    if (!paths[pathKey]) {
      paths[pathKey] = {};
    }

    for (const [methodKey, items] of methodOps.entries()) {
      if (items.length === 1) {
        // Single operation, no collision
        const item = items[0];
        paths[pathKey][methodKey] = buildOperation(item);
      } else {
        // Multiple hosts have the same path+method - include host in operation
        // Use x-oneOf to list all variants
        const variants = items.map(item => ({
          ...buildOperation(item),
          'x-host': item.host
        }));
        
        paths[pathKey][methodKey] = {
          summary: `${methodKey.toUpperCase()} ${pathKey}`,
          description: `Multiple hosts serve this endpoint. Use x-host to identify the server.`,
          responses: {
            '200': {
              description: 'Success (see x-oneOf variants for host-specific responses)'
            }
          },
          'x-oneOf': variants
        };
      }
    }
  }

  return {
    openapi: '3.0.0',
    info,
    servers: Array.from(servers).map(url => ({ url })),
    paths
  };
}

function buildOperation(item: EndpointInventoryItem): Record<string, unknown> {
  const operation: Record<string, unknown> = {
    summary: `${item.method} ${item.urlTemplate}`,
    responses: {
      '200': {
        description: 'Success',
        ...(item.responseSchema && {
          content: {
            'application/json': {
              schema: item.responseSchema
            }
          }
        })
      }
    }
  };

  if (item.requestSchema) {
    operation.requestBody = {
      content: {
        'application/json': {
          schema: item.requestSchema
        }
      }
    };
  }

  if (item.observations.length > 0) {
    operation.description = `Observed ${item.observations.length} time(s)${
      item.avgDurationMs ? `, avg ${Math.round(item.avgDurationMs)}ms` : ''
    }`;
  }

  return operation;
}
