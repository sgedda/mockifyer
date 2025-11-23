"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupMockifyer = setupMockifyer;
const axios_1 = require("axios");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const date_1 = require("./utils/date");
const http_client_factory_1 = require("./clients/http-client-factory");
class MockifyerClass {
    constructor(config) {
        this.mockDataCache = new Map();
        this.processingRequests = new Set();
        this.savingResponses = new Set();
        // Validate and normalize conflicting settings
        if (config.recordMode && config.failOnMissingMock) {
            console.warn('[Mockifyer] Warning: recordMode is true but failOnMissingMock is also set to true. ' +
                'failOnMissingMock is ignored in record mode (real API calls are made to record responses). ' +
                'Setting failOnMissingMock to false.');
            config.failOnMissingMock = false;
        }
        this.config = config;
        this.ensureMockDataDirectory();
        // Create HTTP client based on configuration
        const httpClientConfig = {
            type: config.httpClientType || 'axios',
            baseUrl: config.baseUrl,
            defaultHeaders: config.defaultHeaders,
            axiosInstance: config.axiosInstance
        };
        this.httpClient = (0, http_client_factory_1.createHTTPClient)(httpClientConfig);
        console.log('[Mockifyer] record mode:', config.recordMode);
        if (!config.recordSameEndpoints) {
            this.loadMockData();
        }
        if (!config.recordMode) {
            this.setupMockResponses();
        }
        else {
            this.setupInterceptors();
        }
    }
    ensureMockDataDirectory() {
        if (!fs_1.default.existsSync(this.config.mockDataPath)) {
            fs_1.default.mkdirSync(this.config.mockDataPath, { recursive: true });
        }
    }
    generateRequestKey(request) {
        const normalizedUrl = request.url.toLowerCase();
        const normalizedMethod = request.method.toUpperCase();
        const queryString = request.queryParams ? new URLSearchParams(request.queryParams).toString() : '';
        return `${normalizedMethod}:${normalizedUrl}${queryString ? '?' + queryString : ''}`;
    }
    async findBestMatchingMock(request) {
        console.log(`[Mockifyer] findBestMatchingMock called with:`, {
            method: request.method,
            url: request.url,
            queryParams: request.queryParams
        });
        const requestKey = this.generateRequestKey(request);
        console.log('[Mockifyer] requestKey:', requestKey);
        // Try exact match first
        const exactMatch = this.mockDataCache.get(requestKey);
        if (exactMatch) {
            // Check if the file still exists - if not, remove from cache
            if (!fs_1.default.existsSync(exactMatch.filePath)) {
                console.log(`[Mockifyer] Cached mock file no longer exists: ${exactMatch.filePath}, removing from cache`);
                this.mockDataCache.delete(requestKey);
            }
            else {
                console.log(`[Mockifyer] Using exact mock match for ${requestKey}`);
                return exactMatch;
            }
        }
        // If no exact match and useSimilarMatch is true, try to find a similar match
        if (this.config.useSimilarMatch) {
            console.log(`[Mockifyer] useSimilarMatch enabled, requiredParams config:`, this.config.similarMatchRequiredParams);
            const requestUrl = new URL(request.url);
            const requestPath = requestUrl.pathname;
            for (const [key, cachedMock] of this.mockDataCache.entries()) {
                // Check if the file still exists - if not, skip this cached entry
                if (!fs_1.default.existsSync(cachedMock.filePath)) {
                    console.log(`[Mockifyer] Cached mock file no longer exists: ${cachedMock.filePath}, skipping`);
                    continue;
                }
                const mockData = cachedMock.mockData;
                const mockUrl = new URL(mockData.request.url);
                const mockPath = mockUrl.pathname;
                console.log('[Mockifyer] mockPath:', mockPath);
                console.log('[Mockifyer] requestPath:', requestPath);
                // Only match on path and method
                if (mockPath === requestPath && mockData.request.method === request.method) {
                    // Check if required parameters match (if configured)
                    if (this.config.similarMatchRequiredParams && this.config.similarMatchRequiredParams.length > 0) {
                        const requestParams = request.queryParams || {};
                        const mockParams = mockData.request.queryParams || {};
                        
                        console.log(`[Mockifyer] Checking required params for similar match:`, {
                            requiredParams: this.config.similarMatchRequiredParams,
                            requestParams,
                            mockParams
                        });
                        
                        // Check if all required parameters match
                        const allRequiredParamsMatch = this.config.similarMatchRequiredParams.every(paramName => {
                            const requestValue = requestParams[paramName];
                            const mockValue = mockParams[paramName];
                            
                            // Both must be present and equal, or both must be absent
                            if (requestValue === undefined && mockValue === undefined) {
                                console.log(`[Mockifyer] Required param '${paramName}': both absent, OK`);
                                return true;
                            }
                            
                            // Convert to string for comparison (query params are usually strings)
                            const requestStr = String(requestValue || '');
                            const mockStr = String(mockValue || '');
                            const matches = requestStr === mockStr;
                            
                            console.log(`[Mockifyer] Required param '${paramName}': request='${requestStr}', mock='${mockStr}', match=${matches}`);
                            
                            return matches;
                        });
                        
                        if (!allRequiredParamsMatch) {
                            // Required parameter differs, skip this mock
                            console.log(`[Mockifyer] ❌ Similar path match found but required params differ, skipping: ${requestKey}`);
                            continue;
                        }
                        
                        console.log(`[Mockifyer] ✅ All required params match for similar match`);
                    }
                    
                    console.log(`[Mockifyer] Using similar mock match for ${requestKey} (matched path: ${mockPath}, method: ${request.method})`);
                    return cachedMock;
                }
            }
        }
        return undefined;
    }
    loadMockData() {
        console.log('[Mockifyer] Loading mock data from:', this.config.mockDataPath);
        if (fs_1.default.existsSync(this.config.mockDataPath)) {
            const files = fs_1.default.readdirSync(this.config.mockDataPath);
            console.log('[Mockifyer] Found files:', files);
            let loadedCount = 0;
            files.forEach(file => {
                if (file.endsWith('.json')) {
                    const filePath = path_1.default.join(this.config.mockDataPath, file);
                    const mockData = JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
                    const key = this.generateRequestKey(mockData.request);
                    console.log('[Mockifyer] Loading mock:', key, 'from file:', file);
                    this.mockDataCache.set(key, {
                        mockData,
                        filename: file,
                        filePath: filePath
                    });
                    loadedCount++;
                }
            });
            console.log('[Mockifyer] Loaded', loadedCount, 'mock files into cache');
            console.log('[Mockifyer] Cache size:', this.mockDataCache.size);
        }
        else {
            console.log('[Mockifyer] Mock data directory does not exist:', this.config.mockDataPath);
        }
    }
    setupMockResponses() {
        // Add request interceptor to handle mock responses
        this.httpClient.interceptors.request.use(async (config) => {
            const request = {
                method: config.method || 'GET',
                url: config.url || '',
                headers: config.headers || {},
                data: config.data,
                queryParams: config.params
            };
            const cachedMock = await this.findBestMatchingMock(request);
            if (cachedMock) {
                const { mockData, filename, filePath } = cachedMock;
                // Add mockifyer headers to indicate this is a mocked response
                const responseHeaders = {
                    ...mockData.response.headers,
                    'x-mockifyer': 'true',
                    'x-mockifyer-timestamp': mockData.timestamp,
                    'x-mockifyer-filename': filename,
                    'x-mockifyer-filepath': filePath
                };
                // Return a mock response using adapter (axios-specific)
                // The adapter bypasses the actual HTTP call and returns a mock response
                // Use AxiosHeaders to ensure headers are properly preserved
                const axiosHeaders = new axios_1.AxiosHeaders();
                Object.entries(responseHeaders).forEach(([key, value]) => {
                    axiosHeaders.set(key, value);
                });
                const mockResponse = {
                    data: mockData.response.data,
                    status: mockData.response.status,
                    statusText: 'OK',
                    headers: axiosHeaders,
                    config: config, // AxiosResponse expects InternalAxiosRequestConfig
                    request: {}
                };
                console.log('[Mockifyer] Returning mock response with headers:', Object.keys(responseHeaders));
                console.log('[Mockifyer] Mock headers:', responseHeaders);
                console.log('[Mockifyer] AxiosHeaders keys:', Array.from(axiosHeaders.keys()));
                console.log('[Mockifyer] Checking x-mockifyer in AxiosHeaders:', axiosHeaders.get('x-mockifyer'));
                return {
                    ...config,
                    adapter: () => {
                        console.log('[Mockifyer] Adapter called, returning mock response');
                        console.log('[Mockifyer] Mock response headers type:', typeof mockResponse.headers);
                        console.log('[Mockifyer] Mock response headers forEach:', typeof mockResponse.headers.forEach);
                        return Promise.resolve(mockResponse);
                    }
                };
            }
            if (this.config.failOnMissingMock) {
                throw new Error(`No mock data found for request: ${this.generateRequestKey(request)}`);
            }
            return config;
        });
    }
    setupInterceptors() {
        // In record mode, only check for mocks if recordSameEndpoints is false
        // This allows re-recording when recordSameEndpoints is true
        // When recordSameEndpoints is false, use existing mocks to avoid unnecessary API calls
        if (this.config.recordSameEndpoints !== true) {
            this.httpClient.interceptors.request.use(async (config) => {
                const request = {
                    method: config.method || 'GET',
                    url: config.url || '',
                    headers: config.headers || {},
                    data: config.data,
                    queryParams: config.params
                };
                const requestKey = this.generateRequestKey(request);
                
                // Prevent infinite loops - if we're already processing this request, skip
                if (this.processingRequests.has(requestKey)) {
                    console.log(`[Mockifyer] ⚠️ Already processing ${requestKey}, skipping to prevent infinite loop`);
                    return config;
                }
                
                console.log(`[Mockifyer] 🔍 Processing request: ${requestKey}`);
                this.processingRequests.add(requestKey);
                
                try {
                    const cachedMock = await this.findBestMatchingMock(request);
                    if (cachedMock) {
                        // Use existing mock instead of making real API call
                        // This is correct behavior - we have a mock, so use it
                        const { mockData, filename, filePath } = cachedMock;
                        const responseHeaders = {
                            ...mockData.response.headers,
                            'x-mockifyer': 'true',
                            'x-mockifyer-timestamp': mockData.timestamp,
                            'x-mockifyer-filename': filename,
                            'x-mockifyer-filepath': filePath
                        };
                        const axiosHeaders = new axios_1.AxiosHeaders();
                        Object.entries(responseHeaders).forEach(([key, value]) => {
                            axiosHeaders.set(key, value);
                        });
                        const mockResponse = {
                            data: mockData.response.data,
                            status: mockData.response.status,
                            statusText: 'OK',
                            headers: axiosHeaders,
                            config: config,
                            request: {}
                        };
                        console.log(`[Mockifyer] ✅ Found mock, returning mock response for ${requestKey}`);
                        
                        const result = {
                            ...config,
                            adapter: () => {
                                console.log(`[Mockifyer] 📦 Adapter called, returning mock response for ${requestKey}`);
                                return Promise.resolve(mockResponse);
                            }
                        };
                        
                        // Remove from processing set immediately after creating the result
                        this.processingRequests.delete(requestKey);
                        
                        return result;
                    }
                    
                    // No mock found - will make real API call (this is correct)
                    console.log(`[Mockifyer] ❌ No mock found for ${requestKey}, will make real API call`);
                    this.processingRequests.delete(requestKey);
                    return config;
                } catch (error) {
                    console.error(`[Mockifyer] ❌ Error processing ${requestKey}:`, error);
                    this.processingRequests.delete(requestKey);
                    throw error;
                }
            });
        }
        else {
            // recordSameEndpoints is true - always make real API calls, don't check for mocks
            console.log('[Mockifyer] recordSameEndpoints=true, will always make real API calls');
        }
        // Add response interceptor to record responses (only for real API calls)
        // Skip recording if this is a mocked response (has x-mockifyer header)
        this.httpClient.interceptors.response.use((response) => {
            var _a;
            // Check if this is a mocked response - if so, don't record it
            const isMocked = response.headers && ((typeof response.headers.get === 'function' && response.headers.get('x-mockifyer') === 'true') ||
                (typeof response.headers === 'object' && !Array.isArray(response.headers) && response.headers['x-mockifyer'] === 'true'));
            if (isMocked) {
                console.log('[Mockifyer] Skipping recording - this is a mocked response');
                return response;
            }
            console.log('[Mockifyer] Recording response for:', {
                method: ((_a = response.config.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'GET',
                url: response.config.url
            });
            this.saveResponse(response);
            return response;
        }, (error) => {
            var _a;
            if (error.response) {
                // Check if this is a mocked error response
                const isMocked = error.response.headers && ((typeof error.response.headers.get === 'function' && error.response.headers.get('x-mockifyer') === 'true') ||
                    (typeof error.response.headers === 'object' && !Array.isArray(error.response.headers) && error.response.headers['x-mockifyer'] === 'true'));
                if (isMocked) {
                    console.log('[Mockifyer] Skipping recording - this is a mocked error response');
                    return Promise.reject(error);
                }
                console.log('[Mockifyer] Recording error response for:', {
                    method: ((_a = error.response.config.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'GET',
                    url: error.response.config.url,
                    status: error.response.status
                });
                this.saveResponse(error.response);
            }
            return Promise.reject(error);
        });
    }
    anonymizeHeaders(headers) {
        // Default headers to anonymize (common API key headers)
        const defaultHeadersToAnonymize = [
            'x-rapidapi-key',
            'x-api-key',
            'authorization',
            'api-key',
            'apikey',
            'x-auth-token',
            'x-access-token',
            'bearer'
        ];
        const headersToAnonymize = this.config.anonymizeHeaders !== undefined
            ? this.config.anonymizeHeaders
            : defaultHeadersToAnonymize;
        // If explicitly set to empty array, don't anonymize
        if (headersToAnonymize.length === 0) {
            return headers;
        }
        const anonymized = Object.assign({}, headers);
        const lowerCaseHeadersToAnonymize = headersToAnonymize.map(h => h.toLowerCase());
        // Anonymize headers (case-insensitive)
        for (const [key, value] of Object.entries(anonymized)) {
            if (value && typeof value === 'string' && lowerCaseHeadersToAnonymize.includes(key.toLowerCase())) {
                // Keep first 4 and last 4 characters if key is long enough, otherwise just show it's anonymized
                if (value.length > 8) {
                    anonymized[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
                }
                else {
                    anonymized[key] = '***ANONYMIZED***';
                }
            }
        }
        return anonymized;
    }
    anonymizeQueryParams(queryParams) {
        // Default query params to anonymize (common API key params)
        const defaultQueryParamsToAnonymize = [
            'api_key', 'apikey', 'api-key',
            'key', 'token', 'access_token', 'access-token',
            'auth_token', 'auth-token',
            'secret', 'password'
        ];
        const queryParamsToAnonymize = this.config.anonymizeQueryParams !== undefined
            ? this.config.anonymizeQueryParams
            : defaultQueryParamsToAnonymize;
        if (queryParamsToAnonymize.length === 0) {
            return queryParams;
        }
        const anonymized = Object.assign({}, queryParams);
        const lowerCaseQueryParamsToAnonymize = queryParamsToAnonymize.map(p => p.toLowerCase());
        for (const [key, value] of Object.entries(anonymized)) {
            if (value != null && typeof value === 'string' && lowerCaseQueryParamsToAnonymize.includes(key.toLowerCase())) {
                if (value.length > 8) {
                    anonymized[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
                }
                else {
                    anonymized[key] = '***ANONYMIZED***';
                }
            }
        }
        return anonymized;
    }
    async saveResponse(response) {
        var _a, _b;
        // Generate request key to check if we're already saving this response
        const tempRequest = {
            method: ((_a = response.config.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'GET',
            url: response.config.url || '',
            headers: {},
            queryParams: response.config.params || {}
        };
        const requestKey = this.generateRequestKey(tempRequest);
        
        // Prevent duplicate saves
        if (this.savingResponses.has(requestKey)) {
            console.log(`[Mockifyer] ⚠️ Already saving response for ${requestKey}, skipping duplicate save`);
            return;
        }
        
        this.savingResponses.add(requestKey);
        
        try {
            // Extract headers as plain object (handle AxiosHeaders instances)
            let originalHeaders = {};
            if (response.config.headers) {
                if (typeof response.config.headers.toJSON === 'function') {
                    // AxiosHeaders instance
                    originalHeaders = response.config.headers.toJSON();
                }
                else if (typeof response.config.headers.get === 'function') {
                    // Headers-like object with get method
                    const headersObj = {};
                    const headers = response.config.headers;
                    if (headers.forEach) {
                        headers.forEach((value, key) => {
                            headersObj[key] = value;
                        });
                    }
                    else {
                        // Fallback: try to iterate
                        for (const key in headers) {
                            if (headers.hasOwnProperty(key)) {
                                headersObj[key] = headers[key];
                            }
                        }
                    }
                    originalHeaders = headersObj;
                }
                else {
                    // Plain object
                    originalHeaders = response.config.headers;
                }
            }
            
            // Anonymize headers and query params before saving
            const anonymizedHeaders = this.anonymizeHeaders(originalHeaders);
            const anonymizedQueryParams = this.anonymizeQueryParams(response.config.params || {});
            
            const request = {
                method: tempRequest.method,
                url: tempRequest.url,
                headers: anonymizedHeaders,
                data: response.config.data,
                queryParams: anonymizedQueryParams
            };
            
            // Always check cache first, unless recordSameEndpoints is true
            if (this.config.recordSameEndpoints !== true) {
                const existingMock = await this.findBestMatchingMock(request);
                if (existingMock) {
                    console.log(`[Mockifyer] Using existing mock for endpoint: ${request.url}`);
                    return;
                }
            }
            
            const storedResponse = {
                status: response.status,
                data: response.data,
                headers: response.headers
            };
            const mockData = {
                request,
                response: storedResponse,
                timestamp: new Date().toISOString(),
                scenario: (_b = this.config.scenarios) === null || _b === void 0 ? void 0 : _b.default
            };
            // Format the datetime to be readable
            const now = new Date();
            const dateStr = now.toISOString()
                .replace(/T/, '_')
                .replace(/\..+/, '')
                .replace(/:/g, '-');
            // Create a safe filename from the URL
            const urlSafe = request.url
                .replace(/^https?:\/\//, '')
                .replace(/[^a-zA-Z0-9]/g, '_');
            const filename = `${dateStr}_${request.method}_${urlSafe}.json`;
            const filePath = path_1.default.join(this.config.mockDataPath, filename);
            // Add to cache immediately
            const key = this.generateRequestKey(request);
            this.mockDataCache.set(key, {
                mockData,
                filename,
                filePath
            });
            console.log(`[Mockifyer] 📹 Recording response for: ${requestKey}`);
            console.log(`[Mockifyer] Added new mock to cache: ${key}`);
            fs_1.default.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
        }
        finally {
            // Remove from saving set after save completes
            this.savingResponses.delete(requestKey);
        }
    }
    getHTTPClient() {
        return this.httpClient;
    }
    /**
     * Reload mock data from the filesystem, clearing the cache first
     * Useful when mock files are added, removed, or modified
     */
    reloadMockData() {
        console.log('[Mockifyer] Reloading mock data...');
        this.mockDataCache.clear();
        this.loadMockData();
    }
    /**
     * Clear stale cache entries (remove entries where files no longer exist)
     * Returns the number of entries removed
     */
    clearStaleCacheEntries() {
        let removedCount = 0;
        for (const [key, cachedMock] of this.mockDataCache.entries()) {
            if (!fs_1.default.existsSync(cachedMock.filePath)) {
                console.log(`[Mockifyer] Removing stale cache entry: ${key} (file: ${cachedMock.filename})`);
                this.mockDataCache.delete(key);
                removedCount++;
            }
        }
        if (removedCount > 0) {
            console.log(`[Mockifyer] Removed ${removedCount} stale cache entries`);
        }
        return removedCount;
    }
}
function setupMockifyer(config) {
    // Initialize date manipulation
    (0, date_1.initializeDateManipulation)(config);
    const mockifyer = new MockifyerClass(config);
    const httpClient = mockifyer.getHTTPClient();
    // Extend the HTTPClient with cache management methods
    return Object.assign(httpClient, {
        reloadMockData: () => mockifyer.reloadMockData(),
        clearStaleCacheEntries: () => mockifyer.clearStaleCacheEntries()
    });
}
// Re-export date utilities and types
__exportStar(require("./utils/date"), exports);
__exportStar(require("./types"), exports);
__exportStar(require("./clients/http-client-factory"), exports);
__exportStar(require("./types/http-client"), exports);
