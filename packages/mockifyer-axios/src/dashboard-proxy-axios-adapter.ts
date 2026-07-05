import { AxiosError, AxiosHeaders, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import {
  performDashboardProxyRequest,
  getActiveInboundClientId,
  getOutboundMockifyerClientIdHeader,
  type HTTPRequestConfig,
  type HTTPResponse,
} from '@sgedda/mockifyer-core';

type AxiosAdapterFn = (config: AxiosRequestConfig) => Promise<AxiosResponse>;

function invokeAxiosDefaultAdapter(adapterConfig: AxiosRequestConfig): Promise<AxiosResponse> {
  const bypassConfig = { ...adapterConfig };
  delete bypassConfig.adapter;
  const axiosAdapters = require('axios/lib/adapters/adapters.js') as {
    default: { getAdapter: (name: unknown) => AxiosAdapterFn };
  };
  const axiosDefaults = require('axios/lib/defaults/index.js') as { default: { adapter: unknown } };
  const fallbackAdapter = axiosAdapters.default.getAdapter(axiosDefaults.default.adapter);
  return fallbackAdapter(bypassConfig);
}

const DASHBOARD_PROXY_AXIOS_ADAPTER = Symbol.for('mockifyer.dashboardProxyAxiosAdapter');

type DashboardProxyAxiosAdapterFn = AxiosAdapterFn & {
  [DASHBOARD_PROXY_AXIOS_ADAPTER]?: true;
};

function isDashboardProxyAxiosAdapter(adapter: unknown): adapter is DashboardProxyAxiosAdapterFn {
  return typeof adapter === 'function' && (adapter as DashboardProxyAxiosAdapterFn)[DASHBOARD_PROXY_AXIOS_ADAPTER] === true;
}

export interface DashboardProxyAxiosAdapterOptions {
  proxyBaseUrl: string;
  proxyScenario?: string;
  proxyRecordOnMiss?: boolean;
  proxyRecordResponses: boolean;
  strictLaneScenario: boolean;
  upstreamTlsInsecure: boolean;
  clientId?: string;
  deviceId?: string;
  baseUrl?: string;
  getClientId?: () => string | undefined;
}

/**
 * Resolves the final request URL (including `params`) for dashboard proxy routing.
 */
export function resolveAxiosRequestUrl(config: AxiosRequestConfig, baseUrl?: string): string {
  const resolvedBaseUrl = config.baseURL || baseUrl;
  let url = resolvedBaseUrl ? new URL(config.url || '', resolvedBaseUrl).toString() : config.url || '';
  if (!url) {
    throw new Error('URL is required');
  }

  if (config.params && Object.keys(config.params).length > 0) {
    const urlObj = new URL(url);
    Object.entries(config.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        urlObj.searchParams.append(key, String(value));
      }
    });
    url = urlObj.toString();
  }

  return url;
}

function headersToRecord(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers || typeof headers !== 'object') {
    return out;
  }

  const maybeForEach = headers as { forEach?: (cb: (value: string, key: string) => void) => void };
  if (typeof maybeForEach.forEach === 'function') {
    maybeForEach.forEach((value: string, key: string) => {
      if (value !== undefined && value !== null) {
        out[key.toLowerCase()] = String(value);
      }
    });
    return out;
  }

  Object.entries(headers as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      out[key.toLowerCase()] = String(value);
    }
  });
  return out;
}

function resolvedClientLane(
  hopHeaders: unknown,
  options: DashboardProxyAxiosAdapterOptions
): string | undefined {
  const fromHop = getOutboundMockifyerClientIdHeader(hopHeaders);
  if (fromHop) {
    return fromHop;
  }
  const fromInbound = getActiveInboundClientId();
  if (fromInbound) {
    return fromInbound;
  }
  if (options.getClientId) {
    const v = options.getClientId();
    if (v != null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  if (options.clientId != null && String(options.clientId).trim() !== '') {
    return String(options.clientId).trim();
  }
  return undefined;
}

function httpResponseToAxiosResponse(
  config: AxiosRequestConfig,
  response: HTTPResponse
): AxiosResponse {
  const axiosHeaders = new AxiosHeaders();
  Object.entries(response.headers).forEach(([key, value]) => {
    axiosHeaders.set(key, value);
  });

  const axiosResponse = {
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: axiosHeaders,
    config: config as AxiosResponse['config'],
    request: {},
  } as AxiosResponse;

  if (response.mockifyerProxyRecording) {
    (axiosResponse.config as HTTPRequestConfig & { mockifyerProxyRecording?: unknown }).mockifyerProxyRecording =
      response.mockifyerProxyRecording;
  }

  return axiosResponse;
}

/**
 * Resolve or reject based on the response status, honoring `config.validateStatus`.
 * 
 * Axios's built-in adapters (http/xhr/fetch) run every response through its internal
 * `settle()` before resolving, which is what rejects non-2xx responses with an
 * `AxiosError`. A custom adapter must do the same, otherwise non-2xx responses resolve
 * instead of rejecting and callers see different error semantics through the proxy than
 * they do against the real HTTP adapter. This mirrors axios core `settle`, using only the
 * public `AxiosError` export to avoid depending on axios internals.
 */
function settleAxiosResponse(
  resolve: (value: AxiosResponse) => void,
  reject: (reason: unknown) => void,
  response: AxiosResponse
): void {
  const validateStatus = response.config?.validateStatus;
  if (!response.status || !validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    reject(
      new AxiosError(
        `Request failed with status code ${response.status}`,
        [AxiosError.ERR_BAD_REQUEST, AxiosError.ERR_BAD_RESPONSE][Math.floor(response.status / 100) - 4],
        response.config,
        response.request,
        response
      )
    )
  }
}

/**
 * Attach an axios `adapter` that routes the request through mockifyer-dashboard `/api/proxy`.
 * Required when `useGlobalAxios: true` — interceptors alone do not replace axios's HTTP adapter.
 */
export function attachDashboardProxyAxiosAdapter(
  config: AxiosRequestConfig,
  options: DashboardProxyAxiosAdapterOptions
): AxiosRequestConfig {
  if ((config as { __mockifyer_bypass?: boolean }).__mockifyer_bypass) {
    return config;
  }

  const previousAdapter = config.adapter;

  const dashboardProxyAdapter: DashboardProxyAxiosAdapterFn = async (adapterConfig: AxiosRequestConfig) => {
    if ((adapterConfig as { __mockifyer_bypass?: boolean }).__mockifyer_bypass) {
      if (typeof previousAdapter === 'function' && !isDashboardProxyAxiosAdapter(previousAdapter)) {
        return (previousAdapter as AxiosAdapterFn)(adapterConfig);
      }
      return invokeAxiosDefaultAdapter(adapterConfig);
    }

    const url = resolveAxiosRequestUrl(adapterConfig, options.baseUrl);
    const lane = resolvedClientLane(adapterConfig.headers, options);
    const headers = headersToRecord(adapterConfig.headers);

    const httpResponse = await performDashboardProxyRequest({
      proxyBaseUrl: options.proxyBaseUrl,
      url,
      method: (adapterConfig.method || 'GET').toUpperCase(),
      headers,
      body: adapterConfig.data ?? null,
      lane,
      deviceId: options.deviceId,
      requestId: (adapterConfig as { __mockifyer_requestId?: string }).__mockifyer_requestId,
      parentRequestId: (adapterConfig as { __mockifyer_parentRequestId?: string })
        .__mockifyer_parentRequestId,
      scenario: options.proxyScenario,
      recordOnMiss: options.proxyRecordOnMiss,
      recordResponses: options.proxyRecordResponses,
      strictLaneScenario: options.strictLaneScenario,
      upstreamTlsInsecure: options.upstreamTlsInsecure,
      config: adapterConfig as HTTPRequestConfig,
      logTag: 'Mockifyer-Axios',
    });

    const axiosResponse = httpResponseToAxiosResponse(adapterConfig, httpResponse);
    return new Promise<AxiosResponse>((resolve, reject) => {
      settleAxiosResponse(resolve, reject, axiosResponse)
    })
  };
  dashboardProxyAdapter[DASHBOARD_PROXY_AXIOS_ADAPTER] = true;

  return {
    ...config,
    adapter: dashboardProxyAdapter,
  };
}
