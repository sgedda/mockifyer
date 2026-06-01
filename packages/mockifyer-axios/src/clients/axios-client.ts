import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  BaseHTTPClient,
  HTTPRequestConfig,
  HTTPResponse,
  getActiveInboundClientId,
  getOutboundMockifyerClientIdHeader,
  getOutboundMockifyerDeviceIdHeader,
  MOCKIFYER_CLIENT_ID_HEADER,
  MOCKIFYER_DEVICE_ID_HEADER,
  performDashboardProxyRequest,
} from '@sgedda/mockifyer-core';

export class AxiosHTTPClient extends BaseHTTPClient<any, HTTPResponse<any>> {
  private instance: AxiosInstance;
  private baseUrl?: string;
  private proxyBaseUrl?: string;
  private proxyScenario?: string;
  private proxyRecordOnMiss?: boolean;
  private proxyRecordResponses: boolean;
  private getClientId?: () => string | undefined;
  private getStrictLaneScenario?: () => boolean;
  private getExplicitProxyScenarioContext?: () => boolean;
  private clientIdSnapshot?: string;
  private deviceId?: string;

  constructor(
    instance?: AxiosInstance,
    config?: {
      baseUrl?: string;
      proxy?: {
        baseUrl: string;
        scenario?: string;
        recordOnMiss?: boolean;
        recordResponses?: boolean;
        strictLaneScenario?: boolean;
      };
      clientId?: string;
      getClientId?: () => string | undefined;
      getStrictLaneScenario?: () => boolean;
      getExplicitProxyScenarioContext?: () => boolean;
      deviceId?: string;
    }
  ) {
    super();
    this.instance = instance || axios.create();
    this.baseUrl = config?.baseUrl;
    this.proxyBaseUrl = config?.proxy?.baseUrl;
    this.proxyScenario = config?.proxy?.scenario;
    this.proxyRecordOnMiss = config?.proxy?.recordOnMiss;
    this.proxyRecordResponses = config?.proxy?.recordResponses ?? false;
    this.getClientId = config?.getClientId;
    this.getStrictLaneScenario = config?.getStrictLaneScenario;
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
    if ((config as { __mockResponse?: HTTPResponse }).__mockResponse) {
      return (config as { __mockResponse: HTTPResponse }).__mockResponse;
    }

    let url = this.baseUrl ? new URL(config.url || '', this.baseUrl).toString() : config.url;
    if (!url) {
      throw new Error('URL is required');
    }

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
        console.error('[AxiosHTTPClient] Error adding params to URL:', error);
        throw error;
      }
    }

    const lane = this.resolvedClientLane(config.headers);
    const bypassMockifyer =
      (config as { __mockifyer_bypass?: boolean }).__mockifyer_bypass === true ||
      (config as { __mockifyer_skip_save?: boolean }).__mockifyer_skip_save === true;
    const hopRequestId = (config as { __mockifyer_requestId?: string }).__mockifyer_requestId;
    const hopParentRequestId = (config as { __mockifyer_parentRequestId?: string })
      .__mockifyer_parentRequestId;
    const explicitProxyContext = this.getExplicitProxyScenarioContext?.() ?? true;

    if (this.proxyBaseUrl && !bypassMockifyer && explicitProxyContext) {
      const headers: Record<string, string> = { ...(config.headers as Record<string, string>) };
      if (!bypassMockifyer && lane && !getOutboundMockifyerClientIdHeader(headers)) {
        headers[MOCKIFYER_CLIENT_ID_HEADER] = lane;
      }
      if (
        !bypassMockifyer &&
        this.deviceId &&
        String(this.deviceId).trim() &&
        !getOutboundMockifyerDeviceIdHeader(headers)
      ) {
        headers[MOCKIFYER_DEVICE_ID_HEADER] = String(this.deviceId).trim();
      }
      return performDashboardProxyRequest({
        proxyBaseUrl: this.proxyBaseUrl,
        url,
        method: (config.method || 'GET').toUpperCase(),
        headers,
        body: config.data ?? null,
        lane,
        deviceId: this.deviceId,
        requestId: hopRequestId,
        parentRequestId: hopParentRequestId,
        scenario: this.proxyScenario,
        recordOnMiss: this.proxyRecordOnMiss,
        recordResponses: this.proxyRecordResponses,
        strictLaneScenario: this.getStrictLaneScenario?.() ?? true,
        config,
        logTag: 'Mockifyer-Axios',
      });
    }

    const axiosConfig: AxiosRequestConfig = {
      ...config,
      url,
      headers: config.headers,
      params: config.params,
      data: config.data,
      timeout: config.timeout,
    };

    const response = await this.instance.request(axiosConfig);

    const headersOut: Record<string, string> = {};
    const rawHeaders = response.headers;
    if (rawHeaders && typeof rawHeaders === 'object') {
      const maybeAxiosHeaders = rawHeaders as { forEach?: (cb: (value: string, key: string) => void) => void };
      if (typeof maybeAxiosHeaders.forEach === 'function') {
        maybeAxiosHeaders.forEach((value: string, key: string) => {
          if (value !== undefined && value !== null) {
            headersOut[key.toLowerCase()] = String(value);
          }
        });
      } else {
        Object.entries(rawHeaders).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            headersOut[key.toLowerCase()] = String(value);
          }
        });
      }
    }

    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: headersOut,
      config,
    };
  }

  protected getDefaultHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const commonHeaders = this.instance.defaults.headers.common;
    if (commonHeaders) {
      Object.entries(commonHeaders).forEach(([key, value]) => {
        if (value !== undefined) {
          headers[key] = String(value);
        }
      });
    }
    return headers;
  }

  protected getDefaultConfig(): Record<string, unknown> {
    return {
      ...this.instance.defaults,
      headers: undefined,
    };
  }
}
