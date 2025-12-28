import { HTTPClient, HTTPRequestConfig, HTTPResponse } from '../types/http-client';

export abstract class BaseHTTPClient<T = any, R = HTTPResponse<T>> implements HTTPClient<T, R> {
  protected abstract performRequest<D = any>(config: HTTPRequestConfig<D>): Promise<R>;
  protected abstract getDefaultHeaders(): Record<string, string>;
  protected abstract getDefaultConfig(): Record<string, any>;

  protected requestInterceptors: Array<{
    onFulfilled?: (config: HTTPRequestConfig) => HTTPRequestConfig | Promise<HTTPRequestConfig>;
    onRejected?: (error: any) => any;
  }> = [];

  protected responseInterceptors: Array<{
    onFulfilled?: (response: R) => R | Promise<R>;
    onRejected?: (error: any) => any;
  }> = [];

  get defaults() {
    return {
      headers: this.getDefaultHeaders(),
      ...this.getDefaultConfig()
    };
  }

  get interceptors() {
    return {
      request: {
        use: (onFulfilled?: (config: HTTPRequestConfig) => HTTPRequestConfig | Promise<HTTPRequestConfig>,
              onRejected?: (error: any) => any) => {
          this.requestInterceptors.push({ onFulfilled, onRejected });
          return this.requestInterceptors.length - 1;
        },
        eject: (id: number) => {
          this.requestInterceptors.splice(id, 1);
        },
        clear: () => {
          this.requestInterceptors = [];
        }
      },
      response: {
        use: (onFulfilled?: (response: R) => R | Promise<R>,
              onRejected?: (error: any) => any) => {
          this.responseInterceptors.push({ onFulfilled, onRejected });
          return this.responseInterceptors.length - 1;
        },
        eject: (id: number) => {
          this.responseInterceptors.splice(id, 1);
        },
        clear: () => {
          this.responseInterceptors = [];
        }
      }
    };
  }

  async request<D = any>(config: HTTPRequestConfig<D>): Promise<R> {
    console.log('[BaseHTTPClient] ⚡⚡⚡⚡⚡ request() CALLED:', {
      url: config.url,
      method: config.method,
      hasParams: !!config.params,
      params: config.params,
      constructor: this.constructor.name,
      hasRequestInterceptors: this.requestInterceptors.length > 0,
      hasMockResponseAlready: !!(config as any).__mockResponse,
      allConfigKeys: Object.keys(config)
    });
    // Apply request interceptors
    let processedConfig = { ...config };
    for (const interceptor of this.requestInterceptors) {
      if (interceptor.onFulfilled) {
        console.log('[BaseHTTPClient] Applying request interceptor...');
        const interceptorResult = await interceptor.onFulfilled(processedConfig);
        console.log('[BaseHTTPClient] After interceptor:', {
          url: interceptorResult.url,
          hasMockResponse: !!(interceptorResult as any).__mockResponse,
          hasAdapter: !!(interceptorResult as any).adapter,
          allKeys: Object.keys(interceptorResult),
          mockResponseType: (interceptorResult as any).__mockResponse ? typeof (interceptorResult as any).__mockResponse : 'none'
        });
        // CRITICAL: Preserve all properties from interceptor result, especially __mockResponse
        // Use Object.assign to ensure all properties including non-enumerable ones are copied
        processedConfig = Object.assign({}, processedConfig, interceptorResult);
        // Explicitly preserve __mockResponse if it exists (critical for fetch clients)
        if ((interceptorResult as any).__mockResponse !== undefined) {
          (processedConfig as any).__mockResponse = (interceptorResult as any).__mockResponse;
          console.log('[BaseHTTPClient] ✅ Explicitly preserved __mockResponse from interceptor:', {
            type: typeof (processedConfig as any).__mockResponse,
            isPromise: (processedConfig as any).__mockResponse instanceof Promise,
            hasThen: !!(processedConfig as any).__mockResponse && typeof (processedConfig as any).__mockResponse.then === 'function'
          });
        } else {
          console.log('[BaseHTTPClient] ⚠️ No __mockResponse in interceptor result');
        }
      }
    }

    // Check if mock response is set (for fetch) or adapter (for axios)
    // CRITICAL: Check for __mockResponse BEFORE calling performRequest
    const mockResponseValue = (processedConfig as any).__mockResponse;
    const hasMockResponse = mockResponseValue !== undefined && mockResponseValue !== null;
    console.log('[BaseHTTPClient] 🔍🔍🔍 Checking for __mockResponse:', {
      hasMockResponse,
      mockResponseValue: mockResponseValue !== undefined ? 'EXISTS' : 'undefined',
      mockResponseType: hasMockResponse ? typeof mockResponseValue : 'none',
      isPromise: hasMockResponse ? (mockResponseValue instanceof Promise) : false,
      hasThen: hasMockResponse ? (typeof mockResponseValue?.then === 'function') : false,
      hasAdapter: !!(processedConfig as any).adapter,
      allKeys: Object.keys(processedConfig),
      processedConfigHasMockResponse: '__mockResponse' in processedConfig
    });
    
    if (hasMockResponse) {
      console.log('[BaseHTTPClient] ✅✅✅ Found __mockResponse, returning mock without calling performRequest');
      const mockResponse = (processedConfig as any).__mockResponse;
      // If it's a Promise, await it; otherwise return directly
      // Check if it's a Promise using multiple methods (some Promise implementations might not pass instanceof check)
      const isPromise = mockResponse instanceof Promise || 
                       (mockResponse && typeof mockResponse.then === 'function');
      
      console.log('[BaseHTTPClient] 🔍 Mock response check:', {
        isPromise,
        isInstanceofPromise: mockResponse instanceof Promise,
        hasThen: typeof mockResponse?.then === 'function',
        type: typeof mockResponse
      });
      
      if (isPromise) {
        console.log('[BaseHTTPClient] 🔄 __mockResponse is a Promise, awaiting...');
        const resolved = await mockResponse;
        console.log('[BaseHTTPClient] ✅✅✅ Resolved mock response Promise, returning:', {
          status: resolved?.status,
          hasData: !!resolved?.data,
          headers: Object.keys(resolved?.headers || {}),
          headerKeys: Object.keys(resolved?.headers || {})
        });
        return resolved;
      }
      console.log('[BaseHTTPClient] ✅✅✅ Returning mock response directly:', {
        status: mockResponse?.status,
        hasData: !!mockResponse?.data,
        headers: Object.keys(mockResponse?.headers || {}),
        headerKeys: Object.keys(mockResponse?.headers || {})
      });
      return mockResponse;
    }
    
    console.log('[BaseHTTPClient] ⚠️⚠️⚠️ NO __mockResponse found, will call performRequest()');

    // Perform the request
    console.log('[BaseHTTPClient] Calling performRequest...');
    let response = await this.performRequest(processedConfig);

    // Apply response interceptors
    for (const interceptor of this.responseInterceptors) {
      if (interceptor.onFulfilled) {
        response = await interceptor.onFulfilled(response);
      }
    }

    return response;
  }

  get<D = any>(url: string, config?: HTTPRequestConfig<D>): Promise<R> {
    console.log('[BaseHTTPClient] ⚡⚡⚡⚡⚡ get() CALLED:', {
      url,
      hasConfig: !!config,
      constructor: this.constructor.name,
      hasRequestMethod: typeof this.request === 'function',
      requestMethod: typeof this.request,
      thisType: typeof this,
      prototype: Object.getPrototypeOf(this).constructor.name
    });
    const requestConfig = { ...config, method: 'GET', url };
    console.log('[BaseHTTPClient] ⚡⚡⚡⚡⚡ Request config before calling request():', {
      url: requestConfig.url,
      method: requestConfig.method,
      hasParams: !!requestConfig.params,
      params: requestConfig.params,
      allKeys: Object.keys(requestConfig)
    });
    console.log('[BaseHTTPClient] ⚡⚡⚡⚡⚡ About to call this.request()...', {
      requestConfigUrl: requestConfig.url,
      requestConfigMethod: requestConfig.method,
      hasParams: !!requestConfig.params
    });
    try {
      const result = this.request(requestConfig);
      console.log('[BaseHTTPClient] ⚡⚡⚡⚡⚡ this.request() returned:', typeof result);
      return result;
    } catch (error) {
      console.error('[BaseHTTPClient] ⚡⚡⚡⚡⚡ ERROR calling this.request():', error);
      throw error;
    }
  }

  post<D = any>(url: string, data?: D, config?: HTTPRequestConfig<D>): Promise<R> {
    return this.request({ ...config, method: 'POST', url, data });
  }

  put<D = any>(url: string, data?: D, config?: HTTPRequestConfig<D>): Promise<R> {
    return this.request({ ...config, method: 'PUT', url, data });
  }

  delete<D = any>(url: string, config?: HTTPRequestConfig<D>): Promise<R> {
    return this.request({ ...config, method: 'DELETE', url });
  }

  patch<D = any>(url: string, data?: D, config?: HTTPRequestConfig<D>): Promise<R> {
    return this.request({ ...config, method: 'PATCH', url, data });
  }

  head<D = any>(url: string, config?: HTTPRequestConfig<D>): Promise<R> {
    return this.request({ ...config, method: 'HEAD', url });
  }

  options<D = any>(url: string, config?: HTTPRequestConfig<D>): Promise<R> {
    return this.request({ ...config, method: 'OPTIONS', url });
  }

  getUri<D = any>(config?: HTTPRequestConfig<D>): string {
    if (!config?.url) {
      throw new Error('URL is required');
    }
    const url = new URL(config.url);
    if (config.params) {
      Object.entries(config.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    return url.toString();
  }
} 