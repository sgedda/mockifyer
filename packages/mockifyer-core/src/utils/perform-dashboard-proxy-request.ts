import { MOCKIFYER_CLIENT_ID_HEADER, MOCKIFYER_DEVICE_ID_HEADER } from './activation-mode';
import {
  MOCKIFYER_PARENT_REQUEST_ID_HEADER,
  MOCKIFYER_REQUEST_ID_HEADER,
} from './request-correlation';
import {
  mapProxyPayloadSourceToNetworkSource,
  recordInlineTraceHopFromExchange,
  unwrapAndMergeInlineTraceEnvelope,
} from './inline-trace';
import { buildDashboardProxyEnvelope } from './dashboard-proxy-envelope';
import {
  isMockifyerDashboardProxyApiUrl,
  joinProxyDashboardApiUrl,
} from './join-proxy-dashboard-api-url';
import { serializeProxyRequestBody } from './serialize-proxy-request-body';
import type { HTTPRequestConfig, HTTPResponse, MockifyerProxyRecordingMeta } from '../types/http-client';
import type { MockData } from '../types';
import {
  resolveMockifyerTraceFromProxyPayload,
  stripMockifyerTraceFromBody,
} from './mockifyer-trace';
import { logger } from './logger';

const MOCKIFYER_ORIGINAL_FETCH_KEY = '__mockifyer_original_fetch';

/**
 * Prefer the unpatched fetch stored when Mockifyer patches `global.fetch`, so the
 * internal POST to `/api/proxy` is not re-intercepted by a dual axios+fetch setup.
 */
function resolveDashboardProxyFetchFn(fetchFn?: typeof fetch): typeof fetch {
  if (fetchFn) {
    return fetchFn;
  }
  try {
    const g = globalThis as typeof globalThis & { [MOCKIFYER_ORIGINAL_FETCH_KEY]?: typeof fetch };
    if (typeof g[MOCKIFYER_ORIGINAL_FETCH_KEY] === 'function') {
      return g[MOCKIFYER_ORIGINAL_FETCH_KEY]!;
    }
  } catch {
    // ignore
  }
  return fetch;
}

export interface PerformDashboardProxyRequestParams {
  proxyBaseUrl: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  lane: string | undefined;
  deviceId: string | undefined;
  requestId: string | undefined;
  parentRequestId: string | undefined;
  scenario: string | undefined;
  recordOnMiss: boolean | undefined;
  recordResponses: boolean;
  strictLaneScenario: boolean;
  upstreamTlsInsecure: boolean;
  /** Original request config (attached to the returned response). */
  config: HTTPRequestConfig;
  /** Fetch implementation (defaults to global `fetch`). */
  fetchFn?: typeof fetch;
  logTag?: string;
}

/**
 * POST to mockifyer-dashboard `/api/proxy` and map the JSON payload to {@link HTTPResponse}.
 */
export async function performDashboardProxyRequest(
  params: PerformDashboardProxyRequestParams
): Promise<HTTPResponse> {
  const {
    proxyBaseUrl,
    url,
    method,
    headers,
    body,
    lane,
    deviceId,
    requestId,
    parentRequestId,
    scenario,
    recordOnMiss,
    recordResponses,
    strictLaneScenario,
    upstreamTlsInsecure,
    config,
    logTag = 'Mockifyer',
  } = params;
  const fetchFn = resolveDashboardProxyFetchFn(params.fetchFn);
  const startedAt = Date.now();
  const serializedBody = await serializeProxyRequestBody(body, headers);
  const proxyUrl = joinProxyDashboardApiUrl(proxyBaseUrl, 'api/proxy');
  const proxyResponse = await fetchFn(proxyUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(lane ? { [MOCKIFYER_CLIENT_ID_HEADER]: lane } : {}),
      ...(deviceId ? { [MOCKIFYER_DEVICE_ID_HEADER]: deviceId } : {}),
      ...(requestId ? { [MOCKIFYER_REQUEST_ID_HEADER]: requestId } : {}),
      ...(parentRequestId ? { [MOCKIFYER_PARENT_REQUEST_ID_HEADER]: parentRequestId } : {}),
    },
    body: JSON.stringify(
      buildDashboardProxyEnvelope({
        url,
        method,
        lane,
        deviceId,
        requestId,
        parentRequestId,
        headers,
        body: serializedBody,
        scenario,
        recordOnMiss,
        recordResponses,
        strictLaneScenario,
        upstreamTlsInsecure,
      })
    ),
  });
  if (!proxyResponse.ok) {
    const txt = await proxyResponse.text();
    throw new Error(`[${logTag}] Proxy error: ${proxyResponse.status} ${txt}`);
  }
  const payload = (await proxyResponse.json()) as Record<string, unknown>;
  const outerProxyHeaders: Record<string, string> = {};
  proxyResponse.headers.forEach((value: string, key: string) => {
    outerProxyHeaders[key.toLowerCase()] = value;
  });
  try {
    const source = String(payload?.source || '');
    const hash = typeof payload?.hash === 'string' ? payload.hash : '';
    if (source) {
      const hashShort = hash ? `${hash.slice(0, 8)}…` : '';
      const laneLabel = lane ? lane : '—';
      const kind = source === 'redis' ? 'mock hit' : 'upstream';
      logger.debug(
        `[${logTag}] Proxy ${kind}: ${method} ${url} ${
          hashShort ? `(hash=${hashShort}) ` : ''
        }(lane=${laneLabel})`
      );
    }
  } catch {
    // ignore logging failures
  }
  const proxyResponseBody = payload.response as
    | { data?: unknown; status?: number; headers?: Record<string, string> }
    | undefined;
  let data = proxyResponseBody?.data;
  const status = proxyResponseBody?.status ?? 200;
  const responseHeaders: Record<string, string> = proxyResponseBody?.headers ?? {};

  const mockifyerTrace = resolveMockifyerTraceFromProxyPayload(
    payload,
    outerProxyHeaders,
    responseHeaders
  );

  const scenarioResolution = payload?.scenarioResolution as { scenario?: string | null } | undefined;
  const scenarioName =
    typeof scenarioResolution?.scenario === 'string' && scenarioResolution.scenario.trim()
      ? scenarioResolution.scenario.trim()
      : undefined;

  const mockifyerProxyRecording: MockifyerProxyRecordingMeta | undefined =
    payload?.recordedToStore === true && payload?.storedMock
      ? {
          recordedToStore: true as const,
          storedMock: payload.storedMock as MockData,
          hash: typeof payload.hash === 'string' ? payload.hash : undefined,
          scenarioName,
        }
      : undefined;

  // Parent hop first, then merge any nested mockifyerTrace from the downstream service.
  // Skip when `url` is itself `/api/proxy` (re-entrant dual axios+fetch interception).
  if (!isMockifyerDashboardProxyApiUrl(url)) {
    recordInlineTraceHopFromExchange({
      method,
      url,
      status,
      source: mapProxyPayloadSourceToNetworkSource(
        typeof payload?.source === 'string' ? payload.source : undefined
      ),
      transport: 'proxy',
      requestId: requestId ?? null,
      parentRequestId: parentRequestId ?? null,
      durationMs: Math.max(0, Date.now() - startedAt),
      clientId: lane ?? null,
      requestBody: body,
      responseBody: data,
    });
  }
  data = unwrapAndMergeInlineTraceEnvelope(data);
  data = stripMockifyerTraceFromBody(data);

  return {
    data,
    status,
    statusText: String(status),
    headers: responseHeaders,
    config,
    mockifyerProxyRecording,
    ...(mockifyerTrace ? { mockifyerTrace } : {}),
  };
}
