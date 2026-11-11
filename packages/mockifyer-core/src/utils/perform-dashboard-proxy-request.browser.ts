/**
 * Browser implementation of dashboard proxy using fetch API.
 * Matches the Node version's signature but uses fetch instead of http module.
 */

import type { HTTPRequestConfig, HTTPResponse, MockifyerProxyRecordingMeta } from '../types/http-client';
import { buildDashboardProxyEnvelope } from './dashboard-proxy-envelope';
import { joinProxyDashboardApiUrl } from './join-proxy-dashboard-api-url';
import { serializeProxyRequestBody } from './serialize-proxy-request-body';
import { mapProxyPayloadSourceToNetworkSource } from './inline-trace';
import { resolveMockifyerTraceFromProxyPayload } from './mockifyer-trace';
import type { MockData } from '../types';

const MOCKIFYER_ORIGINAL_FETCH_KEY = '__mockifyer_original_fetch';

/**
 * Resolve unpatched fetch to avoid re-intercepting our own proxy call.
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
  config: HTTPRequestConfig;
  fetchFn?: typeof fetch;
  logTag?: string;
}

/**
 * Browser implementation: POST to dashboard /api/proxy via fetch and return HTTPResponse.
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
    fetchFn,
  } = params;

  const serializedBody = await serializeProxyRequestBody(body, headers);
  const proxyUrl = joinProxyDashboardApiUrl(proxyBaseUrl, '/api/proxy');
  const envelope = buildDashboardProxyEnvelope({
    url,
    method,
    headers,
    body: serializedBody,
    lane,
    deviceId,
    requestId,
    parentRequestId,
    scenario,
    recordOnMiss,
    recordResponses,
    strictLaneScenario,
    upstreamTlsInsecure,
  });

  const useFetch = resolveDashboardProxyFetchFn(fetchFn);

  try {
    const response = await useFetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelope),
    });

    if (!response.ok) {
      throw new Error(
        `Dashboard proxy request failed: ${response.status} ${response.statusText}`
      );
    }

    const payload = await response.json();

    const outerProxyHeaders: Record<string, string> = {};
    response.headers.forEach((value: string, key: string) => {
      outerProxyHeaders[key.toLowerCase()] = value;
    });

    const proxyResponseBody = payload.response as
      | { data?: unknown; status?: number; headers?: Record<string, string> }
      | undefined;
    const data = proxyResponseBody?.data;
    const status = proxyResponseBody?.status ?? 200;
    const responseHeaders: Record<string, string> = { ...(proxyResponseBody?.headers ?? {}) };

    const networkSource = mapProxyPayloadSourceToNetworkSource(
      typeof payload?.source === 'string' ? payload.source : undefined
    );
    if (networkSource === 'mock-hit') {
      responseHeaders['x-mockifyer'] = 'true';
    }

    const mockifyerTrace = resolveMockifyerTraceFromProxyPayload(
      payload,
      outerProxyHeaders,
      responseHeaders
    );

    const responseConfig: HTTPRequestConfig = {
      ...(config || {}),
      __mockifyer_skip_save: true,
    };

    const adoptedRequestId = mockifyerTrace?.requestId ?? requestId;
    const adoptedParentRequestId =
      mockifyerTrace != null ? mockifyerTrace.parentRequestId : parentRequestId;
    if (adoptedRequestId) {
      (responseConfig as any).__mockifyer_requestId = adoptedRequestId;
    }
    if (adoptedParentRequestId) {
      (responseConfig as any).__mockifyer_parentRequestId = adoptedParentRequestId;
    } else {
      delete (responseConfig as any).__mockifyer_parentRequestId;
    }

    const scenarioResolution = payload?.scenarioResolution as { scenario?: string | null } | undefined;
    const scenarioName =
      typeof scenarioResolution?.scenario === 'string' && scenarioResolution.scenario.trim()
        ? scenarioResolution.scenario.trim()
        : undefined;

    const mockifyerProxyRecording =
      payload?.recordedToStore === true && payload?.storedMock
        ? {
            recordedToStore: true as const,
            storedMock: payload.storedMock as MockData,
            hash: typeof payload.hash === 'string' ? payload.hash : undefined,
            scenarioName,
          }
        : undefined;

    const effectiveTrace =
      mockifyerTrace ??
      (adoptedRequestId
        ? adoptedParentRequestId
          ? { requestId: adoptedRequestId, parentRequestId: adoptedParentRequestId }
          : { requestId: adoptedRequestId }
        : undefined);

    return {
      data,
      status,
      statusText: String(status),
      headers: responseHeaders,
      config: responseConfig,
      mockifyerProxyRecording,
      ...(effectiveTrace ? { mockifyerTrace: effectiveTrace } : {}),
    };
  } catch (error) {
    throw new Error(
      `[Mockifyer Browser Proxy] ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
