import { BaseHTTPClient } from '@sgedda/mockifyer-core';
import { HTTPRequestConfig, HTTPResponse } from '@sgedda/mockifyer-core';

export class FetchHTTPClient extends BaseHTTPClient<any, HTTPResponse<any>> {
  private baseUrl?: string;
  private defaultHeaders: Record<string, string>;
  private proxyBaseUrl?: string;
  private proxyScenario?: string;
  private proxyRecordOnMiss: boolean;

  constructor(config?: {
    baseUrl?: string;
    defaultHeaders?: Record<string, string>;
    proxy?: { baseUrl: string; scenario?: string; recordOnMiss?: boolean };
  }) {
    super();
    this.baseUrl = config?.baseUrl;
    this.defaultHeaders = config?.defaultHeaders || {};
    this.proxyBaseUrl = config?.proxy?.baseUrl;
    this.proxyScenario = config?.proxy?.scenario;
    this.proxyRecordOnMiss = config?.proxy?.recordOnMiss ?? false;
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
    
    // Proxy mode (e.g. React Native → dashboard → Redis)
    if (this.proxyBaseUrl) {
      const proxyUrl = new URL('/api/proxy', this.proxyBaseUrl).toString();
      const proxyResponse = await fetchFn(proxyUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url,
          method: requestConfig.method,
          headers: (() => {
            const out: Record<string, string> = {};
            headers.forEach((value, key) => {
              out[key] = value;
            });
            return out;
          })(),
          body: config.data ?? null,
          scenario: this.proxyScenario,
          record: this.proxyRecordOnMiss,
        }),
      });
      if (!proxyResponse.ok) {
        const txt = await proxyResponse.text();
        throw new Error(`[FetchHTTPClient] Proxy error: ${proxyResponse.status} ${txt}`);
      }
      const payload = await proxyResponse.json();
      const data = payload?.response?.data;
      const status = payload?.response?.status ?? 200;
      const responseHeaders: Record<string, string> = payload?.response?.headers ?? {};

      return {
        data,
        status,
        statusText: String(status),
        headers: responseHeaders,
        config,
      };
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

