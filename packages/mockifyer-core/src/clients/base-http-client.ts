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
    // Apply request interceptors
    let processedConfig = { ...config };
    for (const interceptor of this.requestInterceptors) {
      if (interceptor.onFulfilled) {
        const interceptorResult = await interceptor.onFulfilled(processedConfig);
        // CRITICAL: Preserve all properties from interceptor result, especially __mockResponse
        // Use Object.assign to ensure all properties including non-enumerable ones are copied
        processedConfig = Object.assign({}, processedConfig, interceptorResult);
        // Explicitly preserve __mockResponse if it exists (critical for fetch clients)
        if ((interceptorResult as any).__mockResponse !== undefined) {
          (processedConfig as any).__mockResponse = (interceptorResult as any).__mockResponse;
        }
      }
    }

    // Check if mock response is set (for fetch) or adapter (for axios)
    // CRITICAL: Check for __mockResponse BEFORE calling performRequest
    const mockResponseValue = (processedConfig as any).__mockResponse;
    const hasMockResponse = mockResponseValue !== undefined && mockResponseValue !== null;
    
    if (hasMockResponse) {
      const mockResponse = (processedConfig as any).__mockResponse;
      // If it's a Promise, await it; otherwise return directly
      // Check if it's a Promise using multiple methods (some Promise implementations might not pass instanceof check)
      const isPromise = mockResponse instanceof Promise || 
                       (mockResponse && typeof mockResponse.then === 'function');
      
      if (isPromise) {
        return await mockResponse;
      }
      return mockResponse;
    }

    // Perform the request
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
    const requestConfig = { ...config, method: 'GET', url };
    try {
      return this.request(requestConfig);
    } catch (error) {
      console.error('[BaseHTTPClient] Error calling request():', error);
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