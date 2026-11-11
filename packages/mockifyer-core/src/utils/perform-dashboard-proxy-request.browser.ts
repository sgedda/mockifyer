/**
 * Browser implementation of dashboard proxy using fetch API.
 * Matches the Node version's signature but uses fetch instead of http module.
 */

import type { HTTPRequestConfig, HTTPResponse } from '../types/http-client';
import { buildDashboardProxyEnvelope } from './dashboard-proxy-envelope';
import { joinProxyDashboardApiUrl } from './join-proxy-dashboard-api-url';

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

  const proxyUrl = joinProxyDashboardApiUrl(proxyBaseUrl, '/api/proxy');
  const envelope = buildDashboardProxyEnvelope({
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

    // Build HTTPResponse with all required fields
    const responseHeaders: Record<string, string> = payload.headers || {};
    
    // Add x-mockifyer header for mock hits
    const networkSource = payload?.source;
    if (networkSource === 'mock-hit') {
      responseHeaders['x-mockifyer'] = 'true';
    }

    // Ensure config has __mockifyer_skip_save to prevent re-saving proxy responses
    const responseConfig: HTTPRequestConfig = {
      ...(config || {}),
      __mockifyer_skip_save: true,
    };

    // Adopt request/parent IDs from dashboard if provided
    if (payload.mockifyerTrace?.requestId) {
      (responseConfig as any).__mockifyer_requestId = payload.mockifyerTrace.requestId;
    }
    if (payload.mockifyerTrace?.parentRequestId) {
      (responseConfig as any).__mockifyer_parentRequestId = payload.mockifyerTrace.parentRequestId;
    }

    return {
      data: payload.data,
      status: payload.statusCode || response.status,
      statusText: payload.statusText || response.statusText || '',
      headers: responseHeaders,
      config: responseConfig,
      ...(payload.mockifyerProxyRecording && {
        mockifyerProxyRecording: payload.mockifyerProxyRecording,
      }),
      ...(payload.mockifyerTrace && {
        mockifyerTrace: payload.mockifyerTrace,
      }),
    };
  } catch (error) {
    throw new Error(
      `[Mockifyer Browser Proxy] ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
