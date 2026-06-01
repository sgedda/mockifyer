import { MOCKIFYER_CLIENT_ID_HEADER, MOCKIFYER_DEVICE_ID_HEADER } from './activation-mode';
import {
  MOCKIFYER_PARENT_REQUEST_ID_HEADER,
  MOCKIFYER_REQUEST_ID_HEADER,
} from './request-correlation';
import { buildDashboardProxyEnvelope } from './dashboard-proxy-envelope';
import { joinProxyDashboardApiUrl } from './join-proxy-dashboard-api-url';
import type { HTTPRequestConfig, HTTPResponse, MockifyerProxyRecordingMeta } from '../types/http-client';
import type { MockData } from '../types';
import { logger } from './logger';

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
    config,
    logTag = 'Mockifyer',
  } = params;
  const fetchFn = params.fetchFn ?? fetch;
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
        body,
        scenario,
        recordOnMiss,
        recordResponses,
        strictLaneScenario,
      })
    ),
  });
  if (!proxyResponse.ok) {
    const txt = await proxyResponse.text();
    throw new Error(`[${logTag}] Proxy error: ${proxyResponse.status} ${txt}`);
  }
  const payload = (await proxyResponse.json()) as Record<string, unknown>;
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
  const data = proxyResponseBody?.data;
  const status = proxyResponseBody?.status ?? 200;
  const responseHeaders: Record<string, string> = proxyResponseBody?.headers ?? {};

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

  return {
    data,
    status,
    statusText: String(status),
    headers: responseHeaders,
    config,
    mockifyerProxyRecording,
  };
}
