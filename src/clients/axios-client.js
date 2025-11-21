"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AxiosHTTPClient = void 0;
const axios_1 = __importDefault(require("axios"));
const base_http_client_1 = require("./base-http-client");
class AxiosHTTPClient extends base_http_client_1.BaseHTTPClient {
    constructor(instance) {
        super();
        this.instance = instance || axios_1.default.create();
    }
    async performRequest(config) {
        const axiosConfig = {
            ...config,
            headers: config.headers,
            params: config.params,
            data: config.data,
            timeout: config.timeout
        };
        const response = await this.instance.request(axiosConfig);
        // Convert Axios response to generic HTTPResponse
        // Handle both AxiosHeaders object and plain object formats
        const headers = {};
        // Check if headers is an AxiosHeaders instance (has forEach method) or plain object
        if (response.headers && typeof response.headers === 'object') {
            if (typeof response.headers.forEach === 'function') {
                // It's an AxiosHeaders instance - iterate using forEach
                response.headers.forEach((value, key) => {
                    if (value !== undefined && value !== null) {
                        // Preserve original case for custom headers, lowercase standard headers
                        const headerKey = key.toLowerCase();
                        headers[headerKey] = String(value);
                    }
                });
            }
            else {
                // It's a plain object - use Object.entries
                Object.entries(response.headers).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        headers[key.toLowerCase()] = String(value);
                    }
                });
            }
        }
        return {
            data: response.data,
            status: response.status,
            statusText: response.statusText,
            headers,
            config
        };
    }
    getDefaultHeaders() {
        const headers = {};
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
    getDefaultConfig() {
        return {
            ...this.instance.defaults,
            headers: undefined // We handle headers separately
        };
    }
}
exports.AxiosHTTPClient = AxiosHTTPClient;
