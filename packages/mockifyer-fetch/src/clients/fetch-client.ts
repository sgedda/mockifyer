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
    console.log('[FetchHTTPClient] ⚡⚡⚡ performRequest called:', {
      url: config.url,
      hasParams: !!config.params,
      params: config.params,
      hasMockResponse: !!(config as any).__mockResponse,
      method: config.method
    });
    
    // Check if this is a mock response (set by Mockifyer interceptor)
    if ((config as any).__mockResponse) {
      console.log('[FetchHTTPClient] ✅ Returning mock response, skipping fetch call');
      const mockResponse = (config as any).__mockResponse;
      console.log('[FetchHTTPClient] Mock response status:', mockResponse.status, 'headers:', Object.keys(mockResponse.headers || {}));
      return mockResponse;
    }

    console.log('[FetchHTTPClient] ⚠️ No mock found, making real fetch call');
    console.log('[FetchHTTPClient] ⚠️ Config received:', {
      url: config.url,
      method: config.method,
      hasParams: !!config.params,
      params: config.params,
      baseUrl: this.baseUrl,
      allKeys: Object.keys(config)
    });
    let url = this.baseUrl ? new URL(config.url || '', this.baseUrl).toString() : config.url;
    if (!url) {
      throw new Error('URL is required');
    }

    console.log('[FetchHTTPClient] Initial URL:', url);
    console.log('[FetchHTTPClient] Config params:', config.params);

    // Handle query parameters (params) - append them to the URL
    if (config.params && Object.keys(config.params).length > 0) {
      try {
        const urlObj = new URL(url);
        console.log('[FetchHTTPClient] URL object created, adding params...');
        Object.entries(config.params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            console.log(`[FetchHTTPClient] Adding param: ${key} = ${String(value).substring(0, 10)}...`);
            urlObj.searchParams.append(key, String(value));
          }
        });
        url = urlObj.toString();
        console.log('[FetchHTTPClient] ✅ Final URL with params:', url.replace(/([?&]key=)[^&]*/, '$1***'));
      } catch (error) {
        console.error('[FetchHTTPClient] ❌ Error adding params to URL:', error);
        throw error;
      }
    } else {
      console.log('[FetchHTTPClient] ⚠️ No params to add to URL');
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

    console.log('[FetchHTTPClient] Request config:', requestConfig);
    console.log('[FetchHTTPClient] Using fetch:', {
      hasOriginalFetch: !!(this as any)._originalFetch,
      originalFetchType: typeof (this as any)._originalFetch,
      globalFetchType: typeof fetch
    });
    
    // Use original fetch if available (when global fetch is patched), otherwise use global fetch
    // CRITICAL: Always use _originalFetch if available to prevent infinite loops
    const fetchFn = (this as any)._originalFetch || fetch;
    if (!(this as any)._originalFetch) {
      console.warn('[FetchHTTPClient] ⚠️ _originalFetch not set! This may cause infinite loops if global fetch is patched.');
      console.warn('[FetchHTTPClient] ⚠️ Using global fetch instead, which may be patched:', typeof fetch);
    } else {
      console.log('[FetchHTTPClient] ✅ Using _originalFetch to prevent infinite loops');
    }
    
    console.log('[FetchHTTPClient] 🔍 About to call fetchFn with URL:', url.replace(/([?&]key=)[^&]*/, '$1***'));
    console.log('[FetchHTTPClient] 🔍 URL has search params:', url.includes('?'));
    const response = await fetchFn(url, requestConfig);
    console.log('[FetchHTTPClient] Response:', response);
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

