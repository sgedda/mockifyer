import {
  BaseHTTPClient,
  HTTPRequestConfig,
  HTTPResponse,
  logger,
  getActiveInboundClientId,
  getOutboundMockifyerClientIdHeader,
  getOutboundMockifyerDeviceIdHeader,
  MOCKIFYER_CLIENT_ID_HEADER,
  MOCKIFYER_DEVICE_ID_HEADER,
  isPlainObjectBody,
  plainObjectToUrlEncoded,
} from '@sgedda/mockifyer-core';
import { performDashboardProxyRequest } from '../core-proxy';

function buildFetchRequestBody(data: unknown, headers: Headers): BodyInit | undefined {
  if (data === undefined || data === null) {
    return undefined;
  }

  if (typeof data === 'string') {
    return data;
  }

  if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
    return data;
  }

  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    return data;
  }

  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return data;
  }

  if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) {
    return data;
  }

  if (
    typeof ArrayBuffer !== 'undefined' &&
    ArrayBuffer.isView(data) &&
    data.buffer instanceof ArrayBuffer
  ) {
    return data as BodyInit;
  }

  if (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream) {
    return data;
  }

  const contentType = headers.get('content-type')?.toLowerCase();
  if (contentType?.includes('application/x-www-form-urlencoded') && isPlainObjectBody(data)) {
    return plainObjectToUrlEncoded(data);
  }

  return JSON.stringify(data);
}

export class FetchHTTPClient extends BaseHTTPClient<any, HTTPResponse<any>> {
  private baseUrl?: string;
  private defaultHeaders: Record<string, string>;
  private proxyBaseUrl?: string;
  private proxyScenario?: string;
  /** When set, included as `record` on `/api/proxy`. When unset, dashboard per-scenario default applies. */
  private proxyRecordOnMiss?: boolean;
  private proxyRecordResponses: boolean;
  private getClientId?: () => string | undefined;
  private getStrictLaneScenario?: () => boolean;
  private getUpstreamTlsInsecure?: () => boolean;
  private getExplicitProxyScenarioContext?: () => boolean;
  private clientIdSnapshot?: string;
  private deviceId?: string;

  constructor(config?: {
    baseUrl?: string;
    defaultHeaders?: Record<string, string>;
    proxy?: {
      baseUrl: string;
      scenario?: string;
      recordOnMiss?: boolean;
      recordResponses?: boolean;
      strictLaneScenario?: boolean;
      mirrorRecordedMocksToClient?: boolean;
    };
    clientId?: string;
    getClientId?: () => string | undefined;
    getStrictLaneScenario?: () => boolean;
    getUpstreamTlsInsecure?: () => boolean;
    /** When false, skip `/api/proxy` and call the real URL (devtools-friendly passthrough). */
    getExplicitProxyScenarioContext?: () => boolean;
    deviceId?: string;
  }) {
    super();
    this.baseUrl = config?.baseUrl;
    this.defaultHeaders = config?.defaultHeaders || {};
    this.proxyBaseUrl = config?.proxy?.baseUrl;
    this.proxyScenario = config?.proxy?.scenario;
    this.proxyRecordOnMiss = config?.proxy?.recordOnMiss;
    this.proxyRecordResponses = config?.proxy?.recordResponses ?? false;
    this.getClientId = config?.getClientId;
    this.getStrictLaneScenario = config?.getStrictLaneScenario;
    this.getUpstreamTlsInsecure = config?.getUpstreamTlsInsecure;
    this.getExplicitProxyScenarioContext = config?.getExplicitProxyScenarioContext;
    this.clientIdSnapshot = config?.clientId;
    this.deviceId = config?.deviceId;
  }

  private resolvedClientLane(hopHeaders?: unknown): string | undefined {
    const fromHop = getOutboundMockifyerClientIdHeader(hopHeaders);
    if (fromHop) {
      return fromHop;
    }
    const fromInbound = getActiveInboundClientId();
    if (fromInbound) {
      return fromInbound;
    }
    if (this.getClientId) {
      const v = this.getClientId();
      if (v != null && String(v).trim() !== '') {
        return String(v).trim();
      }
    }
    if (this.clientIdSnapshot != null && String(this.clientIdSnapshot).trim() !== '') {
      return String(this.clientIdSnapshot).trim();
    }
    return undefined;
  }

  protected async performRequest<D = any>(config: HTTPRequestConfig<D>): Promise<HTTPResponse<any>> {
    // Check if this is a mock response (set by Mockifyer interceptor)
    if ((config as any).__mockResponse) {
      return (config as any).__mockResponse;
    }

    let url = this.baseUrl ? new URL(config.url || '', this.baseUrl).toString() : config.url;
    if (!url) {
      throw new Error('URL is required');
    }

    // Handle query parameters (params) - append them to the URL
    if (config.params && Object.keys(config.params).length > 0) {
      try {
        const urlObj = new URL(url);
        Object.entries(config.params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            urlObj.searchParams.append(key, String(value));
          }
        });
        url = urlObj.toString();
      } catch (error) {
        console.error('[FetchHTTPClient] Error adding params to URL:', error);
        throw error;
      }
    }

    const headers = new Headers({
      ...this.defaultHeaders,
      ...config.headers
    });

    const body = buildFetchRequestBody(config.data, headers);
    const requestConfig: RequestInit = {
      method: config.method || 'GET',
      headers,
      ...(body !== undefined ? { body } : {})
    };
    
    // Use original fetch if available (when global fetch is patched), otherwise use global fetch
    const fetchFn = (this as any)._originalFetch || fetch;
    if (!(this as any)._originalFetch) {
      console.warn('[FetchHTTPClient] _originalFetch not set! This may cause infinite loops if global fetch is patched.');
    }
    
    const lane = this.resolvedClientLane(config.headers);
    const bypassMockifyer =
      (config as any).__mockifyer_bypass === true || (config as any).__mockifyer_skip_save === true;
    const hopRequestId = (config as any).__mockifyer_requestId as string | undefined;
    const hopParentRequestId = (config as any).__mockifyer_parentRequestId as string | undefined;

    const explicitProxyContext = this.getExplicitProxyScenarioContext?.() ?? true;

    if (this.proxyBaseUrl && !bypassMockifyer && explicitProxyContext) {
      const headerRecord: Record<string, string> = {};
      headers.forEach((value, key) => {
        headerRecord[key] = value;
      });
      return performDashboardProxyRequest({
        proxyBaseUrl: this.proxyBaseUrl,
        url,
        method: String(requestConfig.method || 'GET'),
        headers: headerRecord,
        body: config.data ?? null,
        lane,
        deviceId: this.deviceId,
        requestId: hopRequestId,
        parentRequestId: hopParentRequestId,
        scenario: this.proxyScenario,
        recordOnMiss: this.proxyRecordOnMiss,
        recordResponses: this.proxyRecordResponses,
        strictLaneScenario: this.getStrictLaneScenario?.() ?? true,
        upstreamTlsInsecure: this.getUpstreamTlsInsecure?.() ?? false,
        config,
        fetchFn,
        logTag: 'Mockifyer-Fetch',
      });
    }

    if (!bypassMockifyer && lane && !getOutboundMockifyerClientIdHeader(headers)) {
      headers.set(MOCKIFYER_CLIENT_ID_HEADER, lane);
    }
    if (
      !bypassMockifyer &&
      this.deviceId &&
      String(this.deviceId).trim() &&
      !getOutboundMockifyerDeviceIdHeader(headers)
    ) {
      headers.set(MOCKIFYER_DEVICE_ID_HEADER, String(this.deviceId).trim());
    }

    const response = await fetchFn(url, requestConfig);
    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    let data: any = rawText;
    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = rawText;
      }
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value: string, key: string) => {
      responseHeaders[key] = value;
    });

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      config,
    };
  }

  protected getDefaultHeaders(): Record<string, string> {
    return this.defaultHeaders;
  }

  protected getDefaultConfig(): Record<string, any> {
    return {
      baseUrl: this.baseUrl
    };
  }
}
