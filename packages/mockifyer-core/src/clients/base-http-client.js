"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseHTTPClient = void 0;
class BaseHTTPClient {
    constructor() {
        this.requestInterceptors = [];
        this.responseInterceptors = [];
    }
    get defaults() {
        return {
            headers: this.getDefaultHeaders(),
            ...this.getDefaultConfig()
        };
    }
    get interceptors() {
        return {
            request: {
                use: (onFulfilled, onRejected) => {
                    this.requestInterceptors.push({ onFulfilled, onRejected });
                    return this.requestInterceptors.length - 1;
                },
                eject: (id) => {
                    this.requestInterceptors.splice(id, 1);
                },
                clear: () => {
                    this.requestInterceptors = [];
                }
            },
            response: {
                use: (onFulfilled, onRejected) => {
                    this.responseInterceptors.push({ onFulfilled, onRejected });
                    return this.responseInterceptors.length - 1;
                },
                eject: (id) => {
                    this.responseInterceptors.splice(id, 1);
                },
                clear: () => {
                    this.responseInterceptors = [];
                }
            }
        };
    }
    async request(config) {
        // Apply request interceptors
        let processedConfig = { ...config };
        for (const interceptor of this.requestInterceptors) {
            if (interceptor.onFulfilled) {
                const interceptorResult = await interceptor.onFulfilled(processedConfig);
                // CRITICAL: Preserve all properties from interceptor result, especially __mockResponse
                // Use Object.assign to ensure all properties including non-enumerable ones are copied
                processedConfig = Object.assign({}, processedConfig, interceptorResult);
                // Explicitly preserve __mockResponse if it exists (critical for fetch clients)
                if (interceptorResult.__mockResponse !== undefined) {
                    processedConfig.__mockResponse = interceptorResult.__mockResponse;
                }
            }
        }
        // Check if mock response is set (for fetch) or adapter (for axios)
        // CRITICAL: Check for __mockResponse BEFORE calling performRequest
        const mockResponseValue = processedConfig.__mockResponse;
        const hasMockResponse = mockResponseValue !== undefined && mockResponseValue !== null;
        if (hasMockResponse) {
            const mockResponse = processedConfig.__mockResponse;
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
    get(url, config) {
        const requestConfig = { ...config, method: 'GET', url };
        try {
            return this.request(requestConfig);
        }
        catch (error) {
            console.error('[BaseHTTPClient] Error calling request():', error);
            throw error;
        }
    }
    post(url, data, config) {
        return this.request({ ...config, method: 'POST', url, data });
    }
    put(url, data, config) {
        return this.request({ ...config, method: 'PUT', url, data });
    }
    delete(url, config) {
        return this.request({ ...config, method: 'DELETE', url });
    }
    patch(url, data, config) {
        return this.request({ ...config, method: 'PATCH', url, data });
    }
    head(url, config) {
        return this.request({ ...config, method: 'HEAD', url });
    }
    options(url, config) {
        return this.request({ ...config, method: 'OPTIONS', url });
    }
    getUri(config) {
        if (!(config === null || config === void 0 ? void 0 : config.url)) {
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
exports.BaseHTTPClient = BaseHTTPClient;
