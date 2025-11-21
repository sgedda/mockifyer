"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchHTTPClient = void 0;
const base_http_client_1 = require("./base-http-client");
class FetchHTTPClient extends base_http_client_1.BaseHTTPClient {
    constructor(config) {
        super();
        this.baseUrl = config === null || config === void 0 ? void 0 : config.baseUrl;
        this.defaultHeaders = (config === null || config === void 0 ? void 0 : config.defaultHeaders) || {};
    }
    async performRequest(config) {
        const url = this.baseUrl ? new URL(config.url || '', this.baseUrl).toString() : config.url;
        if (!url) {
            throw new Error('URL is required');
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
        const response = await fetch(url, requestConfig);
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
