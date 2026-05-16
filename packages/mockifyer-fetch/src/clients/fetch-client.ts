import { BaseHTTPClient } from '@sgedda/mockifyer-core';
import { HTTPRequestConfig, HTTPResponse } from '@sgedda/mockifyer-core';
import {
  getOutboundMockifyerClientIdHeader,
  getOutboundMockifyerDeviceIdHeader,
  MOCKIFYER_CLIENT_ID_HEADER,
  MOCKIFYER_DEVICE_ID_HEADER,
} from '@sgedda/mockifyer-core';
import { joinProxyDashboardApiUrl } from '../utils/join-proxy-dashboard-api-url';

function buildProxyEnvelope(params: {
  url: string;
  method: string;
  lane: string | undefined;
  deviceId: string | undefined;
  headers: Record<string, string>;
  body: unknown;
  scenario: string | undefined;
  recordOnMiss: boolean | undefined;
  strictLaneScenario: boolean;
}): Record<string, unknown> {
  const {
    url,
    method,
    lane,
    deviceId,
    headers,
    body,
    scenario,
    recordOnMiss,
    strictLaneScenario,
  } = params;
  const envelope: Record<string, unknown> = {
    url,
    method,
    clientId: lane,
    deviceId,
    headers,
    body,
    scenario,
    strictLaneScenario,
  };
  if (typeof recordOnMiss === 'boolean') {
    envelope.record = recordOnMiss;
  }
  return envelope;
}

export class FetchHTTPClient extends BaseHTTPClient<any, HTTPResponse<any>> {
  private baseUrl?: string;
  private defaultHeaders: Record<string, string>;
  private proxyBaseUrl?: string;
  private proxyScenario?: string;
  /** When set, included as `record` on `/api/proxy`. When unset, dashboard per-scenario default applies. */
  private proxyRecordOnMiss?: boolean;
  private getClientId?: () => string | undefined;
  private getStrictLaneScenario?: () => boolean;
  private clientIdSnapshot?: string;
  private deviceId?: string;

  constructor(config?: {
    baseUrl?: string;
    defaultHeaders?: Record<string, string>;
    proxy?: {
      baseUrl: string;
      scenario?: string;
      recordOnMiss?: boolean;
      strictLaneScenario?: boolean;
      mirrorRecordedMocksToClient?: boolean;
    };
    clientId?: string;
    getClientId?: () => string | undefined;
    getStrictLaneScenario?: () => boolean;
    deviceId?: string;
  }) {
    super();
    this.baseUrl = config?.baseUrl;
    this.defaultHeaders = config?.defaultHeaders || {};
    this.proxyBaseUrl = config?.proxy?.baseUrl;
    this.proxyScenario = config?.proxy?.scenario;
    this.proxyRecordOnMiss = config?.proxy?.recordOnMiss;
    this.getClientId = config?.getClientId;
    this.getStrictLaneScenario = config?.getStrictLaneScenario;
    this.clientIdSnapshot = config?.clientId;
    this.deviceId = config?.deviceId;
  }

  private resolvedClientLane(): string | undefined {
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

    const requestConfig: RequestInit = {
      method: config.method || 'GET',
      headers,
      body: config.data ? JSON.stringify(config.data) : undefined
    };
    
    // Use original fetch if available (when global fetch is patched), otherwise use global fetch
    // CRITICAL: Always use _originalFetch if available to prevent infinite loops
    const fetchFn = (this as any)._originalFetch || fetch;
    if (!(this as any)._originalFetch) {
      console.warn('[FetchHTTPClient] _originalFetch not set! This may cause infinite loops if global fetch is patched.');
    }
    
    const lane = this.resolvedClientLane();
    const bypassMockifyer =
      (config as any).__mockifyer_bypass === true || (config as any).__mockifyer_skip_save === true;

    // Proxy mode (e.g. React Native → dashboard → Redis)
    if (this.proxyBaseUrl && !bypassMockifyer) {
      const proxyUrl = joinProxyDashboardApiUrl(this.proxyBaseUrl, 'api/proxy');
      const proxyResponse = await fetchFn(proxyUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(lane ? { [MOCKIFYER_CLIENT_ID_HEADER]: lane } : {}),
          ...(this.deviceId ? { [MOCKIFYER_DEVICE_ID_HEADER]: this.deviceId } : {}),
        },
        body: JSON.stringify(
          buildProxyEnvelope({
            url,
            method: String(requestConfig.method || 'GET'),
            lane,
            deviceId: this.deviceId,
            headers: (() => {
              const out: Record<string, string> = {};
              headers.forEach((value, key) => {
                out[key] = value;
              });
              return out;
            })(),
            body: config.data ?? null,
            scenario: this.proxyScenario,
            recordOnMiss: this.proxyRecordOnMiss,
            strictLaneScenario: this.getStrictLaneScenario?.() ?? true,
          })
        ),
      });
      if (!proxyResponse.ok) {
        const txt = await proxyResponse.text();
        throw new Error(`[FetchHTTPClient] Proxy error: ${proxyResponse.status} ${txt}`);
      }
      const payload = await proxyResponse.json();
      try {
        const source = String(payload?.source || '');
        const hash = typeof payload?.hash === 'string' ? payload.hash : '';
        if (source) {
          const hashShort = hash ? `${hash.slice(0, 8)}…` : '';
          const laneLabel = lane ? lane : '—';
          const kind = source === 'redis' ? 'mock hit' : 'upstream';
          console.log(
            `[Mockifyer-Fetch] Proxy ${kind}: ${requestConfig.method} ${url} ${
              hashShort ? `(hash=${hashShort}) ` : ''
            }(lane=${laneLabel})`
          );
        }
      } catch {
        // ignore logging failures
      }
      const data = payload?.response?.data;
      const status = payload?.response?.status ?? 200;
      const responseHeaders: Record<string, string> = payload?.response?.headers ?? {};

      const scenarioResolution = payload?.scenarioResolution as
        | { scenario?: string | null }
        | undefined;
      const scenarioName =
        typeof scenarioResolution?.scenario === 'string' && scenarioResolution.scenario.trim()
          ? scenarioResolution.scenario.trim()
          : undefined;

      const mockifyerProxyRecording =
        payload?.recordedToStore === true && payload?.storedMock
          ? {
              recordedToStore: true as const,
              storedMock: payload.storedMock,
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

    // Convert response Headers to Record<string, string>
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

