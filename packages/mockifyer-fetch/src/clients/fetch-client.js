"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchHTTPClient = void 0;
const mockifyer_core_1 = require("@sgedda/mockifyer-core");
class FetchHTTPClient extends mockifyer_core_1.BaseHTTPClient {
    constructor(config) {
        super();
        this.baseUrl = config === null || config === void 0 ? void 0 : config.baseUrl;
        this.defaultHeaders = (config === null || config === void 0 ? void 0 : config.defaultHeaders) || {};
    }
    async performRequest(config) {
        // Check if this is a mock response (set by Mockifyer interceptor)
        if (config.__mockResponse) {
            return config.__mockResponse;
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
            }
            catch (error) {
                console.error('[FetchHTTPClient] Error adding params to URL:', error);
                throw error;
            }
        }
        const headers = new Headers({
            ...this.defaultHeaders,
            ...config.headers
        });
        const requestConfig = {
            method: config.method || 'GET',
            headers,
            body: config.data ? JSON.stringify(config.data) : undefined
        };
        // Use original fetch if available (when global fetch is patched), otherwise use global fetch
        // CRITICAL: Always use _originalFetch if available to prevent infinite loops
        const fetchFn = this._originalFetch || fetch;
        if (!this._originalFetch) {
            console.warn('[FetchHTTPClient] _originalFetch not set! This may cause infinite loops if global fetch is patched.');
        }
        const response = await fetchFn(url, requestConfig);
        const data = await response.json();
        // Convert response Headers to Record<string, string>
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
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
    getDefaultHeaders() {
        return this.defaultHeaders;
    }
    getDefaultConfig() {
        return {
            baseUrl: this.baseUrl
        };
    }
}
exports.FetchHTTPClient = FetchHTTPClient;
