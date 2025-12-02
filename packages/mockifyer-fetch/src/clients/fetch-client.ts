import { BaseHTTPClient } from '@sgedda/mockifyer-core';
import { HTTPRequestConfig, HTTPResponse } from '@sgedda/mockifyer-core';

export class FetchHTTPClient extends BaseHTTPClient<any, HTTPResponse<any>> {
  private baseUrl?: string;
  private defaultHeaders: Record<string, string>;

  constructor(config?: { baseUrl?: string; defaultHeaders?: Record<string, string> }) {
    super();
    this.baseUrl = config?.baseUrl;
    this.defaultHeaders = config?.defaultHeaders || {};
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
    
    const response = await fetchFn(url, requestConfig);
    const data = await response.json();

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
      config
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

