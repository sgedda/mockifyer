export function buildDashboardProxyEnvelope(params: {
  url: string;
  method: string;
  lane: string | undefined;
  deviceId: string | undefined;
  requestId: string | undefined;
  parentRequestId: string | undefined;
  headers: Record<string, string>;
  body: unknown;
  scenario: string | undefined;
  recordOnMiss: boolean | undefined;
  recordResponses: boolean;
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
    headers,
    body,
    scenario,
    recordOnMiss,
    recordResponses,
    strictLaneScenario,
    upstreamTlsInsecure,
  } = params;
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
    recordResponses,
    strictLaneScenario,
    upstreamTlsInsecure,
  };
  if (typeof recordOnMiss === 'boolean') {
    envelope.record = recordOnMiss;
  }
  return envelope;
}
