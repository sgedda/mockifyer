export function buildDashboardProxyEnvelope(params: {
  url: string;
  method: string;
  lane: string | undefined;
  deviceId: string | undefined;
  requestId: string | undefined;
  parentRequestId: string | undefined;
  /** Inbound hop that owns `parentRequestId` — dashboard upserts a real catalog row if missing. */
  parentHop?: { method: string; url: string; data?: unknown } | undefined;
  headers: Record<string, string>;
  body: unknown;
  scenario: string | undefined;
  recordOnMiss: boolean | undefined;
  recordResponses: boolean | Array<string | RegExp>;
  strictLaneScenario: boolean;
  upstreamTlsInsecure: boolean;
}): Record<string, unknown> {
  const {
    url,
    method,
    lane,
    deviceId,
    requestId,
    parentRequestId,
    parentHop,
    headers,
    body,
    scenario,
    recordOnMiss,
    recordResponses,
    strictLaneScenario,
    upstreamTlsInsecure,
  } = params;
  
  // Resolve recordResponses to boolean for the proxy envelope using URL-aware matching
  let resolvedRecordResponses: boolean;
  if (typeof recordResponses === 'boolean') {
    resolvedRecordResponses = recordResponses;
  } else {
    // Array of patterns - check if URL matches
    const { shouldRecordResponseForUrl } = require('./record-responses-matcher');
    resolvedRecordResponses = shouldRecordResponseForUrl(url, recordResponses);
  }
  
  const envelope: Record<string, unknown> = {
    url,
    method,
    clientId: lane,
    deviceId,
    requestId,
    parentRequestId,
    headers,
    body,
    scenario,
    recordResponses: resolvedRecordResponses,
    strictLaneScenario,
    upstreamTlsInsecure,
  };
  if (parentHop?.url?.trim() && parentRequestId) {
    envelope.parentHop = {
      method: parentHop.method?.trim() ? parentHop.method.trim().toUpperCase() : 'GET',
      url: parentHop.url.trim(),
      ...(parentHop.data !== undefined ? { data: parentHop.data } : {}),
    };
  }
  if (typeof recordOnMiss === 'boolean') {
    envelope.record = recordOnMiss;
  }
  return envelope;
}
