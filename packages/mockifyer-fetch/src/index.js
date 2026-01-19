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
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupMockifyer = setupMockifyer;
// Fetch-only Mockifyer implementation
// Conditionally import fs - will be undefined in React Native
let fs;
let path;
try {
    // Try to require fs and path - will fail in React Native where they're stubbed
    fs = require('fs');
    path = require('path');
}
catch (e) {
    // fs/path not available (React Native environment)
    fs = undefined;
    path = undefined;
}
// Import from core package
const mockifyer_core_1 = require("@sgedda/mockifyer-core");
const fetch_client_1 = require("./clients/fetch-client");
class MockifyerClass {
    constructor(config) {
        var _a, _b, _c;
        this.processingRequests = new Set();
        this.savingResponses = new Set();
        this.currentSessionId = null;
        this.sessionStartTime = 0;
        this.SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
        // Validate database provider - filesystem, expo-filesystem, hybrid, and memory are supported
        if (config.databaseProvider && config.databaseProvider.type) {
            const supportedTypes = ['filesystem', 'expo-filesystem', 'hybrid', 'memory'];
            if (!supportedTypes.includes(config.databaseProvider.type)) {
                throw new Error(`Database provider type '${config.databaseProvider.type}' is not yet available for use. ` +
                    `Supported types: ${supportedTypes.join(', ')}. ` +
                    `Please use one of the supported provider types.`);
            }
        }
        // Validate and normalize conflicting settings
        if (config.recordMode && config.failOnMissingMock) {
            console.warn('[Mockifyer] Warning: recordMode is true but failOnMissingMock is also set to true. ' +
                'failOnMissingMock is ignored in record mode (real API calls are made to record responses). ' +
                'Setting failOnMissingMock to false.');
            config.failOnMissingMock = false;
        }
        // Validate conflicting similar match settings
        if (config.similarMatchIgnoreAllQueryParams &&
            config.similarMatchRequiredParams &&
            config.similarMatchRequiredParams.length > 0) {
            console.warn('[Mockifyer-Fetch] Warning: Both similarMatchIgnoreAllQueryParams and similarMatchRequiredParams are set. ' +
                'similarMatchIgnoreAllQueryParams takes precedence and all query parameters will be ignored. ' +
                'similarMatchRequiredParams will be ignored.');
            // Clear similarMatchRequiredParams to avoid confusion
            config.similarMatchRequiredParams = undefined;
        }
        // Auto-enable useSimilarMatch if similarMatchRequiredParams is set (and not ignored)
        if (config.similarMatchRequiredParams && config.similarMatchRequiredParams.length > 0) {
            if (config.useSimilarMatch === undefined || config.useSimilarMatch === false) {
                config.useSimilarMatch = true;
            }
        }
        // Auto-enable useSimilarMatch if similarMatchIgnoreAllQueryParams is set
        if (config.similarMatchIgnoreAllQueryParams) {
            if (config.useSimilarMatch === undefined || config.useSimilarMatch === false) {
                config.useSimilarMatch = true;
            }
        }
        // Store config BEFORE any modifications
        this.config = { ...config }; // Create a copy to avoid mutations
        // Initialize test generator if test generation is enabled
        console.log('[Mockifyer-Fetch] HÖHÖHÖ 🔧 Constructor - Full config received:', JSON.stringify({
            generateTests: config.generateTests,
            recordMode: config.recordMode,
            mockDataPath: config.mockDataPath,
            databaseProvider: (_a = config.databaseProvider) === null || _a === void 0 ? void 0 : _a.type
        }, null, 2));
        console.log('[Mockifyer-Fetch] 🔧 Constructor - generateTests config:', JSON.stringify(config.generateTests, null, 2));
        console.log('[Mockifyer-Fetch] 🔧 Constructor - config.generateTests?.enabled:', (_b = config.generateTests) === null || _b === void 0 ? void 0 : _b.enabled);
        if ((_c = config.generateTests) === null || _c === void 0 ? void 0 : _c.enabled) {
            console.log('[Mockifyer-Fetch] ✅ Initializing test generator...');
            this.testGenerator = new mockifyer_core_1.TestGenerator();
            console.log('[Mockifyer-Fetch] ✅ Test generator initialized:', !!this.testGenerator);
        }
        else {
            console.log('[Mockifyer-Fetch] ⚠️ Test generation NOT enabled in config');
            console.log('[Mockifyer-Fetch] ⚠️ Debug - config.generateTests:', config.generateTests);
            console.log('[Mockifyer-Fetch] ⚠️ Debug - typeof config.generateTests:', typeof config.generateTests);
            console.log('[Mockifyer-Fetch] ⚠️ Debug - config keys:', Object.keys(config));
        }
        // Initialize database provider if specified
        if (config.databaseProvider && config.databaseProvider.type) {
            this.databaseProvider = (0, mockifyer_core_1.createProvider)(config.databaseProvider.type, config.databaseProvider);
            const initResult = this.databaseProvider.initialize();
            // Handle async initialization (expo-filesystem provider has async initialize)
            if (initResult instanceof Promise) {
                initResult.catch((error) => {
                    console.error('[Mockifyer-Fetch] Error initializing database provider:', error);
                });
            }
        }
        else {
            // Fallback to Node.js filesystem
            this.ensureMockDataDirectory();
        }
        // Create fetch HTTP client
        this.httpClient = new fetch_client_1.FetchHTTPClient({
            baseUrl: config.baseUrl,
            defaultHeaders: config.defaultHeaders
        });
        if (!config.recordSameEndpoints) {
            this.loadMockData();
        }
        // Always set up mock response interceptor (to use existing mocks)
        this.setupMockResponses();
        // Set up response interceptor to save responses when recordMode is enabled
        this.setupResponseInterceptor();
    }
    ensureMockDataDirectory() {
        // Only use fs if available (Node.js environment) and no database provider is set
        if (!fs || this.databaseProvider) {
            return;
        }
        if (!fs.existsSync(this.config.mockDataPath)) {
            fs.mkdirSync(this.config.mockDataPath, { recursive: true });
        }
    }
    generateRequestKey(request) {
        return (0, mockifyer_core_1.generateRequestKey)(request);
    }
    async findBestMatchingMock(request) {
        // CRITICAL: Never try to match sync endpoint requests - they should never be mocked
        const requestUrl = (request === null || request === void 0 ? void 0 : request.url) || '';
        if (requestUrl.includes('/mockifyer-save') ||
            requestUrl.includes('/mockifyer-clear') ||
            requestUrl.includes('/mockifyer-sync')) {
            return undefined;
        }
        const requestKey = this.generateRequestKey(request);
        // CRITICAL: Also check requestKey for sync endpoint URLs (defense in depth)
        if (requestKey.includes('/mockifyer-save') ||
            requestKey.includes('/mockifyer-clear') ||
            requestKey.includes('/mockifyer-sync')) {
            return undefined;
        }
        // Use database provider if available, otherwise fallback to filesystem
        if (this.databaseProvider) {
            return await this.findBestMatchingMockFromProvider(request);
        }
        // Fallback to Node.js filesystem
        return this.findBestMatchingMockFromFiles(request);
    }
    async findBestMatchingMockFromProvider(request) {
        if (!this.databaseProvider) {
            return undefined;
        }
        // CRITICAL: Never try to match sync endpoint requests - they should never be mocked
        const requestUrl = (request === null || request === void 0 ? void 0 : request.url) || '';
        if (requestUrl.includes('/mockifyer-save') ||
            requestUrl.includes('/mockifyer-clear') ||
            requestUrl.includes('/mockifyer-sync')) {
            return undefined;
        }
        const requestKey = this.generateRequestKey(request);
        // CRITICAL: Also check requestKey for sync endpoint URLs (defense in depth)
        if (requestKey.includes('/mockifyer-save') ||
            requestKey.includes('/mockifyer-clear') ||
            requestKey.includes('/mockifyer-sync')) {
            return undefined;
        }
        // Try exact match first
        const exactMatch = await this.databaseProvider.findExactMatch(request, requestKey);
        if (exactMatch) {
            return exactMatch;
        }
        // Try similar match if enabled
        if (this.config.useSimilarMatch) {
            const similarMatches = await this.databaseProvider.findAllForSimilarMatch(request);
            if (similarMatches && similarMatches.length > 0) {
                // Return first similar match
                return similarMatches[0];
            }
        }
        return undefined;
    }
    findBestMatchingMockFromFiles(request) {
        // Only use fs if available (Node.js environment)
        // This method should never be called when using a database provider
        if (!fs || !path) {
            return undefined;
        }
        const resolvedMockDataPath = path.resolve(this.config.mockDataPath);
        console.log('[Mockifyer-Fetch] 📁 Mock data path:', {
            original: this.config.mockDataPath,
            resolved: resolvedMockDataPath,
            exists: fs.existsSync(resolvedMockDataPath)
        });
        if (!fs.existsSync(resolvedMockDataPath)) {
            console.warn('[Mockifyer-Fetch] ⚠️ Mock data path does not exist:', resolvedMockDataPath);
            return undefined;
        }
        const currentScenario = (0, mockifyer_core_1.getCurrentScenario)(resolvedMockDataPath);
        const scenarioPath = (0, mockifyer_core_1.getScenarioFolderPath)(resolvedMockDataPath, currentScenario);
        console.log('[Mockifyer-Fetch] 📁 Scenario path:', {
            scenario: currentScenario,
            path: scenarioPath,
            exists: fs.existsSync(scenarioPath)
        });
        if (!fs.existsSync(scenarioPath)) {
            console.warn('[Mockifyer-Fetch] ⚠️ Scenario path does not exist:', scenarioPath);
            return undefined;
        }
        const files = fs.readdirSync(scenarioPath)
            .filter(file => file.endsWith('.json'));
        const requestKey = this.generateRequestKey(request);
        let exactMatch;
        let similarMatch;
        console.log('[Mockifyer-Fetch] 🔍 Searching for mock:', {
            requestKey,
            useSimilarMatch: this.config.useSimilarMatch,
            similarMatchIgnoreAllQueryParams: this.config.similarMatchIgnoreAllQueryParams,
            filesCount: files.length,
            files: files.slice(0, 5) // Show first 5 files for debugging
        });
        for (const file of files) {
            try {
                const filePath = path.join(scenarioPath, file);
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const mockData = JSON.parse(fileContent);
                if (!mockData || !mockData.request || typeof mockData.request !== 'object') {
                    continue;
                }
                const mockKey = this.generateRequestKey(mockData.request);
                if (mockKey === requestKey) {
                    console.log('[Mockifyer-Fetch] ✅ Exact match found:', file);
                    exactMatch = { mockData, filename: file, filePath };
                    break;
                }
                if (!exactMatch && this.config.useSimilarMatch && !similarMatch) {
                    // Check if it's a GraphQL request - skip similar matching for GraphQL
                    const isGraphQL = ['POST', 'PUT', 'PATCH'].includes((request.method || 'GET').toUpperCase()) &&
                        request.data &&
                        (() => {
                            try {
                                let bodyData = request.data;
                                if (typeof request.data === 'string') {
                                    bodyData = JSON.parse(request.data);
                                }
                                return typeof bodyData === 'object' && bodyData !== null && typeof bodyData.query === 'string';
                            }
                            catch {
                                return false;
                            }
                        })();
                    if (!isGraphQL) {
                        try {
                            const requestUrl = new URL(request.url);
                            const mockUrl = new URL(mockData.request.url);
                            // Check if pathnames match (exact or pattern-based)
                            const requestPathname = requestUrl.pathname;
                            const mockPathname = mockUrl.pathname;
                            const methodMatch = (mockData.request.method || 'GET').toUpperCase() === (request.method || 'GET').toUpperCase();
                            // Check for exact pathname match
                            const exactPathnameMatch = mockPathname === requestPathname;
                            // Check for pattern-based match (e.g., /posts/71 matches /posts/17 when similarMatchIgnoreAllQueryParams is true)
                            // This allows matching paths with different IDs when we're ignoring query params
                            let patternMatch = false;
                            if (this.config.similarMatchIgnoreAllQueryParams && !exactPathnameMatch && methodMatch) {
                                // Extract base path by removing the last segment (ID)
                                // /posts/71 -> /posts, /users/2/todos -> /users/2
                                const requestSegments = requestPathname.split('/').filter(s => s);
                                const mockSegments = mockPathname.split('/').filter(s => s);
                                // Match if base paths are the same (same number of segments, all but last match)
                                if (requestSegments.length === mockSegments.length && requestSegments.length > 0) {
                                    const requestBase = requestSegments.slice(0, -1);
                                    const mockBase = mockSegments.slice(0, -1);
                                    patternMatch = requestBase.join('/') === mockBase.join('/');
                                }
                            }
                            const pathnameMatch = exactPathnameMatch || patternMatch;
                            console.log('[Mockifyer-Fetch] 🔍 Checking similar match:', {
                                file,
                                requestPathname,
                                mockPathname,
                                requestMethod: (request.method || 'GET').toUpperCase(),
                                mockMethod: (mockData.request.method || 'GET').toUpperCase(),
                                exactPathnameMatch,
                                patternMatch,
                                pathnameMatch,
                                methodMatch
                            });
                            if (pathnameMatch && methodMatch) {
                                // If ignoreAllQueryParams is set, skip query param checking entirely
                                if (this.config.similarMatchIgnoreAllQueryParams) {
                                    // Ignore all query params, match on path and method only
                                    console.log('[Mockifyer-Fetch] ✅ Similar match found (ignoring query params):', file);
                                }
                                else if (this.config.similarMatchRequiredParams && this.config.similarMatchRequiredParams.length > 0) {
                                    // Check if required parameters match (if configured)
                                    const requestParams = request.queryParams || {};
                                    const mockParams = mockData.request.queryParams || {};
                                    const allRequiredMatch = this.config.similarMatchRequiredParams.every((paramName) => {
                                        const requestValue = requestParams[paramName];
                                        const mockValue = mockParams[paramName];
                                        return requestValue === undefined && mockValue === undefined
                                            ? true
                                            : String(requestValue || '') === String(mockValue || '');
                                    });
                                    if (!allRequiredMatch) {
                                        continue; // Required parameter differs, skip this mock
                                    }
                                }
                                similarMatch = { mockData, filename: file, filePath };
                            }
                        }
                        catch (e) {
                            continue;
                        }
                    }
                }
            }
            catch (error) {
                console.warn(`[Mockifyer] Failed to load mock file ${file}:`, error);
            }
        }
        return exactMatch || similarMatch;
    }
    loadMockData() {
        // Skip if using database provider or fs not available
        if (this.databaseProvider || !fs) {
            return;
        }
        if (fs.existsSync(this.config.mockDataPath)) {
            fs.readdirSync(this.config.mockDataPath)
                .filter(file => file.endsWith('.json'));
        }
    }
    setupMockResponses() {
        this.httpClient.interceptors.request.use(async (config) => {
            // CRITICAL: Completely bypass Mockifyer interception for sync endpoints
            // This prevents any Mockifyer processing (mocking, saving, etc.) for these endpoints
            const url = config.url || '';
            if (url.includes('/mockifyer-save') || url.includes('/mockifyer-clear') || url.includes('/mockifyer-sync')) {
                // Mark this request to completely skip Mockifyer processing
                config.__mockifyer_skip_save = true;
                config.__mockifyer_bypass = true;
                return config;
            }
            // Normalize empty params: treat {} the same as undefined for consistent matching
            const rawParams = config.params || {};
            const anonymizedQueryParams = this.anonymizeQueryParams(rawParams);
            const normalizedParams = anonymizedQueryParams && Object.keys(anonymizedQueryParams).length > 0
                ? anonymizedQueryParams
                : undefined;
            const request = {
                method: config.method || 'GET',
                url: config.url || '',
                headers: config.headers || {},
                data: config.data,
                queryParams: normalizedParams
            };
            const requestKey = this.generateRequestKey(request);
            // Store request key for response interceptor
            config.__mockifyer_requestKey = requestKey;
            // Store request start time for duration calculation
            config.__mockifyer_startTime = Date.now();
            const cachedMock = await this.findBestMatchingMock(request);
            if (!cachedMock) {
                console.log('[Mockifyer-Fetch] ⚠️ No mock found for request:', {
                    method: request.method,
                    url: request.url,
                    queryParams: request.queryParams,
                    requestKey: requestKey,
                    mockDataPath: this.config.mockDataPath,
                    hasDatabaseProvider: !!this.databaseProvider
                });
            }
            else {
                console.log('[Mockifyer-Fetch] ✅ Mock found:', {
                    filename: cachedMock.filename,
                    url: request.url
                });
            }
            if (cachedMock) {
                const { mockData, filename, filePath } = cachedMock;
                const responseHeaders = {
                    ...mockData.response.headers,
                    'x-mockifyer': 'true',
                    'x-mockifyer-timestamp': mockData.timestamp,
                    'x-mockifyer-filename': filename,
                    'x-mockifyer-filepath': filePath
                };
                const mockResponse = {
                    data: mockData.response.data,
                    status: mockData.response.status,
                    statusText: 'OK',
                    headers: responseHeaders,
                    config: config
                };
                return {
                    ...config,
                    __mockResponse: Promise.resolve(mockResponse),
                    __mockifyer_requestKey: requestKey
                };
            }
            // Check request limit BEFORE making real API call (only if no mock found and in record mode)
            if (this.config.recordMode) {
                const limitCheck = (0, mockifyer_core_1.checkRequestLimit)(this.config.mockDataPath);
                if (limitCheck.limitReached && limitCheck.error) {
                    console.warn(`[Mockifyer] ⚠️ ${limitCheck.error.message}`);
                    // Return a mock error response instead of making a real API call
                    const responseHeaders = {
                        'x-mockifyer': 'true',
                        'x-mockifyer-limit-reached': 'true',
                        'content-type': 'application/json'
                    };
                    const mockErrorResponse = {
                        data: {
                            error: limitCheck.error.message,
                            message: limitCheck.error.message,
                            limitReached: true,
                            maxRequests: limitCheck.error.maxRequests,
                            currentScenario: limitCheck.error.currentScenario
                        },
                        status: 429, // Too Many Requests
                        statusText: 'Too Many Requests',
                        headers: responseHeaders,
                        config: config
                    };
                    return {
                        ...config,
                        __mockResponse: Promise.resolve(mockErrorResponse),
                        __mockifyer_requestKey: requestKey,
                        __mockifyer_limit_reached: true
                    };
                }
            }
            if (this.config.failOnMissingMock) {
                throw new Error(`No mock data found for request: ${this.generateRequestKey(request)}`);
            }
            return config;
        });
    }
    setupResponseInterceptor() {
        this.httpClient.interceptors.response.use(async (response) => {
            var _a, _b, _c, _d, _e, _f;
            // CRITICAL: Check for skip flag FIRST (set by request interceptor for sync endpoints)
            // This completely bypasses Mockifyer interception for sync endpoints
            if (response.config.__mockifyer_skip_save || response.config.__mockifyer_bypass) {
                return response;
            }
            // CRITICAL: Skip Mockifyer sync endpoints to prevent infinite loops
            // Check multiple ways to get the URL in case response.config is undefined
            const url = ((_a = response.config) === null || _a === void 0 ? void 0 : _a.url) || ((_b = response.request) === null || _b === void 0 ? void 0 : _b.responseURL) || response.url || ((_c = response.config) === null || _c === void 0 ? void 0 : _c.url) || '';
            // CRITICAL: Check URL FIRST before any other processing
            if (url && (url.includes('/mockifyer-save') || url.includes('/mockifyer-clear') || url.includes('/mockifyer-sync'))) {
                // Mark as bypassed to prevent any further processing
                response.config.__mockifyer_skip_save = true;
                response.config.__mockifyer_bypass = true;
                return response;
            }
            // Clean up processing requests tracking
            const requestKey = response.config.__mockifyer_requestKey;
            if (requestKey) {
                this.processingRequests.delete(requestKey);
            }
            // CRITICAL: Check response data for Metro rejection messages (defense in depth)
            // This catches any responses that might have gotten through
            try {
                let responseDataStr = '';
                let responseDataObj = null;
                if (typeof response.data === 'string') {
                    responseDataStr = response.data;
                    try {
                        responseDataObj = JSON.parse(response.data);
                    }
                    catch (e) {
                        // Not JSON, that's fine
                    }
                }
                else if (response.data) {
                    // Try to stringify, but handle circular references
                    try {
                        responseDataStr = JSON.stringify(response.data);
                        responseDataObj = response.data;
                    }
                    catch (stringifyError) {
                        // If stringify fails, try to get a string representation
                        responseDataStr = String(response.data);
                    }
                }
                // CRITICAL: Check for Metro rejection message
                const hasRejectionMessage = responseDataStr && (responseDataStr.includes('Cannot save Mockifyer sync endpoint') ||
                    responseDataStr.includes('Cannot save Mockifyer sync endpoint requests'));
                const hasRejectionInObject = responseDataObj && ((responseDataObj.error && typeof responseDataObj.error === 'string' &&
                    responseDataObj.error.includes('Cannot save Mockifyer sync endpoint')) ||
                    (responseDataObj.success === false && responseDataObj.error));
                if (hasRejectionMessage || hasRejectionInObject) {
                    return response;
                }
                // CRITICAL: Check for sync endpoint URLs in response data
                if (responseDataStr && (responseDataStr.includes('/mockifyer-save') ||
                    responseDataStr.includes('/mockifyer-clear') ||
                    responseDataStr.includes('/mockifyer-sync'))) {
                    console.log('[Mockifyer-Fetch] ⚠️ Bypassing Mockifyer - sync endpoint in response data');
                    return response;
                }
            }
            catch (e) {
                // Ignore errors - continue processing
                console.warn('[Mockifyer-Fetch] Error checking response data:', e);
            }
            const isMocked = response.headers && response.headers['x-mockifyer'] === 'true';
            const isLimitReached = response.headers && response.headers['x-mockifyer-limit-reached'] === 'true';
            if (isMocked || isLimitReached) {
                console.log('[Mockifyer-Fetch] Response is mocked, skipping save' + (isLimitReached ? ' (limit reached)' : ''));
                return response;
            }
            // Only save if recordMode is enabled
            if (this.config.recordMode) {
                console.log('[Mockifyer-Fetch] ✅ recordMode enabled, saving response');
                console.log('[Mockifyer-Fetch] Response URL:', (_d = response.config) === null || _d === void 0 ? void 0 : _d.url);
                console.log('[Mockifyer-Fetch] Response method:', (_e = response.config) === null || _e === void 0 ? void 0 : _e.method);
                console.log('[Mockifyer-Fetch] Response status:', response.status);
                console.log('[Mockifyer-Fetch] Response config.data:', (_f = response.config) === null || _f === void 0 ? void 0 : _f.data);
                console.log('[Mockifyer-Fetch] Response config exists:', !!response.config);
                await this.saveResponse(response);
            }
            else {
                console.log('[Mockifyer-Fetch] ⚠️ recordMode disabled, not saving response');
                console.log('[Mockifyer-Fetch] Current config.recordMode:', this.config.recordMode);
            }
            return response;
        }, async (error) => {
            var _a;
            const requestKey = (_a = error.config) === null || _a === void 0 ? void 0 : _a.__mockifyer_requestKey;
            if (requestKey) {
                this.processingRequests.delete(requestKey);
            }
            throw error;
        });
    }
    async saveResponse(response) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
        console.log('[Mockifyer-Fetch] 💾 saveResponse called');
        console.log('[Mockifyer-Fetch] 💾 Config at saveResponse:', {
            generateTestsEnabled: (_a = this.config.generateTests) === null || _a === void 0 ? void 0 : _a.enabled,
            hasGenerateTests: !!this.config.generateTests,
            recordMode: this.config.recordMode,
            hasDatabaseProvider: !!this.databaseProvider
        });
        console.log('[Mockifyer-Fetch] saveResponse - response.config:', response.config ? {
            url: response.config.url,
            method: response.config.method,
            hasData: !!response.config.data,
            dataType: typeof response.config.data
        } : 'NO CONFIG');
        // CRITICAL: Check for bypass flags FIRST - if set, completely skip processing
        if (((_b = response.config) === null || _b === void 0 ? void 0 : _b.__mockifyer_skip_save) || ((_c = response.config) === null || _c === void 0 ? void 0 : _c.__mockifyer_bypass)) {
            console.log('[Mockifyer-Fetch] ⚠️ saveResponse: BLOCKING - bypass flag set');
            return;
        }
        // CRITICAL: Skip saving responses from Mockifyer sync endpoints and Resend API FIRST
        // Check multiple ways to get the URL in case response.config is undefined
        const url = ((_d = response.config) === null || _d === void 0 ? void 0 : _d.url) || ((_e = response.request) === null || _e === void 0 ? void 0 : _e.responseURL) || response.url || '';
        if (url && (url.includes('/mockifyer-save') ||
            url.includes('/mockifyer-clear') ||
            url.includes('/mockifyer-sync') ||
            url.includes('api.resend.com'))) {
            console.log('[Mockifyer-Fetch] ⚠️ Skipping save - Resend API request:', url);
            return;
        }
        // CRITICAL: Check response data for sync endpoint references and Metro rejection messages
        // This is a defense-in-depth measure
        try {
            let responseDataStr = '';
            if (typeof response.data === 'string') {
                responseDataStr = response.data;
            }
            else if (response.data) {
                try {
                    responseDataStr = JSON.stringify(response.data);
                }
                catch (stringifyError) {
                    responseDataStr = String(response.data);
                }
            }
            // CRITICAL: Check for Metro rejection message
            if (responseDataStr && responseDataStr.includes('Cannot save Mockifyer sync endpoint')) {
                return;
            }
            // CRITICAL: Check for sync endpoint URLs in response data
            if (responseDataStr && (responseDataStr.includes('/mockifyer-save') ||
                responseDataStr.includes('/mockifyer-clear') ||
                responseDataStr.includes('/mockifyer-sync'))) {
                return;
            }
        }
        catch (e) {
            // Ignore JSON stringify errors
            console.warn('[Mockifyer-Fetch] Error checking response data in saveResponse:', e);
        }
        // Normalize empty params: treat {} the same as undefined for consistent matching
        const rawParams = response.config.params || {};
        const normalizedParams = rawParams && Object.keys(rawParams).length > 0 ? rawParams : undefined;
        const requestKey = this.generateRequestKey({
            method: ((_f = response.config.method) === null || _f === void 0 ? void 0 : _f.toUpperCase()) || 'GET',
            url: response.config.url || '',
            headers: {},
            data: response.config.data,
            queryParams: normalizedParams
        });
        if (this.savingResponses.has(requestKey)) {
            return;
        }
        this.savingResponses.add(requestKey);
        try {
            // Normalize empty params: treat {} the same as undefined for consistent matching
            const rawParams = response.config.params || {};
            const anonymizedQueryParams = this.anonymizeQueryParams(rawParams);
            const normalizedParams = anonymizedQueryParams && Object.keys(anonymizedQueryParams).length > 0
                ? anonymizedQueryParams
                : undefined;
            // Generate or reuse sessionId
            const now = Date.now();
            if (!this.currentSessionId || (now - this.sessionStartTime) > this.SESSION_TIMEOUT_MS) {
                // Generate new session ID
                this.currentSessionId = `session-${now}-${Math.random().toString(36).substring(2, 11)}`;
                this.sessionStartTime = now;
            }
            // Calculate request duration if start time is available
            const startTime = response.config.__mockifyer_startTime;
            const duration = startTime ? Date.now() - startTime : undefined;
            const mockData = {
                request: {
                    method: ((_h = (_g = response.config) === null || _g === void 0 ? void 0 : _g.method) === null || _h === void 0 ? void 0 : _h.toUpperCase()) || 'GET',
                    url: ((_j = response.config) === null || _j === void 0 ? void 0 : _j.url) || '',
                    headers: this.anonymizeHeaders(((_k = response.config) === null || _k === void 0 ? void 0 : _k.headers) || {}),
                    data: (_l = response.config) === null || _l === void 0 ? void 0 : _l.data,
                    queryParams: normalizedParams
                },
                response: {
                    status: response.status,
                    data: response.data,
                    headers: response.headers || {}
                },
                timestamp: new Date().toISOString(),
                duration,
                sessionId: this.currentSessionId
            };
            console.log('[Mockifyer-Fetch] Saving mock data:', {
                method: mockData.request.method,
                url: mockData.request.url,
                hasRequestData: !!mockData.request.data,
                responseStatus: mockData.response.status,
                provider: ((_m = this.config.databaseProvider) === null || _m === void 0 ? void 0 : _m.type) || 'filesystem'
            });
            // Use database provider if available, otherwise fallback to filesystem
            if (this.databaseProvider) {
                try {
                    console.log('[Mockifyer-Fetch] 💾 Saving mock via database provider...');
                    await this.databaseProvider.save(mockData);
                    console.log('[Mockifyer-Fetch] ✅ Successfully saved mock using provider');
                    // Generate test if enabled (try to write test files even with database provider)
                    // In React Native Metro bundler (Node.js), fs/path are available for writing test files
                    console.log('[Mockifyer-Fetch] 🔍 Checking test generation config...');
                    console.log('[Mockifyer-Fetch] 🔍 this.config.generateTests:', JSON.stringify(this.config.generateTests, null, 2));
                    console.log('[Mockifyer-Fetch] 🔍 this.config.generateTests?.enabled:', (_o = this.config.generateTests) === null || _o === void 0 ? void 0 : _o.enabled);
                    if ((_p = this.config.generateTests) === null || _p === void 0 ? void 0 : _p.enabled) {
                        console.log('[Mockifyer-Fetch] 🔧 Test generation enabled, attempting to generate test...');
                        console.log('[Mockifyer-Fetch] 🔧 Test generator available:', !!this.testGenerator);
                        console.log('[Mockifyer-Fetch] 🔧 fs available:', !!fs);
                        console.log('[Mockifyer-Fetch] 🔧 path available:', !!path);
                        await this.generateTestForMock(mockData);
                    }
                    else {
                        console.log('[Mockifyer-Fetch] ⚠️ Test generation NOT enabled - skipping');
                        console.log('[Mockifyer-Fetch] ⚠️ Config check:', {
                            hasGenerateTests: !!this.config.generateTests,
                            enabled: (_q = this.config.generateTests) === null || _q === void 0 ? void 0 : _q.enabled,
                            fullConfig: JSON.stringify(this.config.generateTests)
                        });
                    }
                }
                catch (error) {
                    console.error(`[Mockifyer-Fetch] ❌ Error saving mock using ${(_r = this.config.databaseProvider) === null || _r === void 0 ? void 0 : _r.type} provider:`, error);
                    throw error;
                }
            }
            else if (fs && path) {
                // Fallback to Node.js filesystem (only if fs/path are available)
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const urlParts = (response.config.url || '').replace(/https?:\/\//, '').split('/');
                const domain = urlParts[0].replace(/\./g, '_');
                const urlPathPart = urlParts.slice(1).join('_') || 'root';
                const filename = `${timestamp}_${((_s = response.config.method) === null || _s === void 0 ? void 0 : _s.toUpperCase()) || 'GET'}_${domain}_${urlPathPart}.json`;
                const currentScenario = (0, mockifyer_core_1.getCurrentScenario)(this.config.mockDataPath);
                const scenarioPath = (0, mockifyer_core_1.getScenarioFolderPath)(this.config.mockDataPath, currentScenario);
                (0, mockifyer_core_1.ensureScenarioFolder)(this.config.mockDataPath, currentScenario);
                // Check request limit before saving (only if limit is set via env var)
                const limitCheck = (0, mockifyer_core_1.checkRequestLimit)(this.config.mockDataPath);
                if (limitCheck.limitReached && limitCheck.error) {
                    console.warn(`[Mockifyer] ⚠️ ${limitCheck.error.message}`);
                    // Don't throw - just log and return to prevent app crash
                    return;
                }
                const filePath = path.join(scenarioPath, filename);
                fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
                console.log(`[Mockifyer] Saved new mock to file: ${currentScenario}/${filename}`);
                // Generate test if enabled
                if (((_t = this.config.generateTests) === null || _t === void 0 ? void 0 : _t.enabled) && this.testGenerator) {
                    await this.generateTestForMock(mockData);
                }
            }
            else {
                console.warn('[Mockifyer] Cannot save mock: no database provider and fs/path not available');
            }
        }
        finally {
            this.savingResponses.delete(requestKey);
        }
    }
    /**
     * Simple path resolution fallback for React Native (when path module is stubbed)
     */
    resolvePath(...parts) {
        if (path && typeof path.resolve === 'function') {
            return path.resolve(...parts);
        }
        // Fallback: simple string-based path resolution
        const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : '.';
        const joined = parts
            .filter(p => p)
            .join('/')
            .replace(/\/+/g, '/')
            .replace(/^\.\//, '');
        if (joined.startsWith('/')) {
            return joined;
        }
        return `${cwd}/${joined}`.replace(/\/+/g, '/');
    }
    /**
     * Simple dirname fallback for React Native (when path module is stubbed)
     */
    dirname(filePath) {
        if (path && typeof path.dirname === 'function') {
            return path.dirname(filePath);
        }
        // Fallback: extract directory from path string
        const lastSlash = filePath.lastIndexOf('/');
        if (lastSlash <= 0) {
            return '.';
        }
        return filePath.substring(0, lastSlash);
    }
    /**
     * Generates test file for a mock
     */
    async generateTestForMock(mockData) {
        var _a, _b, _c, _d, _e;
        if (!this.testGenerator) {
            return;
        }
        // Check if fs is available for writing test files
        // In React Native runtime, fs is not available, but in Metro bundler (Node.js) it should be
        // Try to require it dynamically if not already available
        let testFs = fs;
        if (!testFs) {
            try {
                testFs = require('fs');
                console.log('[Mockifyer] ✅ Found fs module for test generation');
            }
            catch (e) {
                console.log('[Mockifyer] ⚠️ Test generation skipped: fs not available');
                console.log('[Mockifyer] 💡 Tip: Test generation requires Node.js fs module.');
                console.log('[Mockifyer] 💡 In React Native, tests are generated in Metro bundler (Node.js environment).');
                return;
            }
        }
        // Use the available fs - ensure it's defined and has required methods
        if (!testFs || typeof testFs.writeFileSync !== 'function' || typeof testFs.mkdirSync !== 'function') {
            console.log('[Mockifyer] ⚠️ Test generation skipped: fs module missing required methods');
            console.log('[Mockifyer] 💡 fs.writeFileSync:', typeof (testFs === null || testFs === void 0 ? void 0 : testFs.writeFileSync));
            console.log('[Mockifyer] 💡 fs.mkdirSync:', typeof (testFs === null || testFs === void 0 ? void 0 : testFs.mkdirSync));
            return;
        }
        const fsToUse = testFs;
        try {
            const options = {
                framework: ((_a = this.config.generateTests) === null || _a === void 0 ? void 0 : _a.framework) || 'jest',
                outputPath: ((_b = this.config.generateTests) === null || _b === void 0 ? void 0 : _b.outputPath) || './tests/generated',
                testPattern: ((_c = this.config.generateTests) === null || _c === void 0 ? void 0 : _c.testPattern) || '{endpoint}.test.ts',
                includeSetup: ((_d = this.config.generateTests) === null || _d === void 0 ? void 0 : _d.includeSetup) !== false,
                groupBy: ((_e = this.config.generateTests) === null || _e === void 0 ? void 0 : _e.groupBy) || 'file',
                httpClientType: 'fetch'
            };
            console.log('[Mockifyer] 📝 Test generation options:', JSON.stringify(options, null, 2));
            const testCode = this.testGenerator.generateTest(mockData, options);
            const testFilePath = this.testGenerator.determineTestFilePath(mockData, options);
            console.log('[Mockifyer] 📝 Generated test file path:', testFilePath);
            // Resolve to absolute path (relative to process.cwd() which should be project root in Metro)
            // Use our fallback path resolution that works even when path module is stubbed
            const absoluteTestPath = this.resolvePath(testFilePath);
            console.log('[Mockifyer] 📝 Final absolute test path:', absoluteTestPath);
            // Ensure test directory exists
            const testDir = this.dirname(absoluteTestPath);
            console.log('[Mockifyer] 📝 Test directory:', testDir);
            if (!fsToUse.existsSync(testDir)) {
                console.log('[Mockifyer] 📝 Creating test directory:', testDir);
                fsToUse.mkdirSync(testDir, { recursive: true });
            }
            // Check if test file already exists
            if (fsToUse.existsSync(absoluteTestPath)) {
                console.log('[Mockifyer] 📝 Test file already exists, checking if test needs to be appended...');
                // Extract test info to check if test already exists
                const testInfo = this.testGenerator.analyzeMock(mockData, 'fetch');
                const testName = this.generateTestNameFromInfo(testInfo);
                // Check if test already exists
                const existingContent = fsToUse.readFileSync(absoluteTestPath, 'utf-8');
                if (existingContent.includes(`it('${testName}'`) || existingContent.includes(`it("${testName}"`)) {
                    console.log(`[Mockifyer] ✅ Test already exists in ${absoluteTestPath}, skipping generation`);
                    return;
                }
                // Extract test code without imports and describe wrapper
                const testMatch = testCode.match(/it\('.*?', async \(\) => \{[\s\S]*?\}\);?/);
                if (testMatch) {
                    // Append test to existing describe block
                    const newTest = testMatch[0];
                    const updatedContent = existingContent.replace(/(\s+)(\}\);?\s*)$/, `$1${newTest}\n$1$2`);
                    fsToUse.writeFileSync(absoluteTestPath, updatedContent);
                    console.log(`[Mockifyer] ✅ Appended test to existing file: ${absoluteTestPath}`);
                }
            }
            else {
                // Create new test file
                console.log('[Mockifyer] 📝 Creating new test file...');
                fsToUse.writeFileSync(absoluteTestPath, testCode);
                console.log(`[Mockifyer] ✅ Generated test: ${absoluteTestPath}`);
                console.log(`[Mockifyer] ✅ Test file size: ${fsToUse.statSync(absoluteTestPath).size} bytes`);
            }
        }
        catch (error) {
            console.error('[Mockifyer] ❌ Error generating test:', error);
            console.error('[Mockifyer] ❌ Error stack:', error === null || error === void 0 ? void 0 : error.stack);
            console.error('[Mockifyer] ❌ Error message:', error === null || error === void 0 ? void 0 : error.message);
            // Don't throw - test generation failure shouldn't break mock saving
        }
    }
    /**
     * Helper to generate test name from test info
     */
    generateTestNameFromInfo(testInfo) {
        const method = testInfo.method.toUpperCase();
        const endpoint = testInfo.endpoint;
        if (testInfo.isGraphQL && testInfo.graphQLQuery) {
            const operationMatch = testInfo.graphQLQuery.match(/(?:query|mutation|subscription)\s+(\w+)/);
            if (operationMatch) {
                return `should execute ${operationMatch[1]} query`;
            }
            return 'should execute GraphQL query';
        }
        return `should ${method} ${endpoint}`;
    }
    anonymizeHeaders(headers) {
        const defaultHeadersToAnonymize = [
            'x-rapidapi-key', 'x-api-key', 'authorization', 'api-key', 'apikey',
            'x-auth-token', 'x-access-token', 'bearer'
        ];
        const headersToAnonymize = this.config.anonymizeHeaders !== undefined
            ? this.config.anonymizeHeaders
            : defaultHeadersToAnonymize;
        if (headersToAnonymize.length === 0) {
            return headers;
        }
        const anonymized = { ...headers };
        const lowerCaseHeadersToAnonymize = headersToAnonymize.map((h) => h.toLowerCase());
        Object.keys(anonymized).forEach(key => {
            if (lowerCaseHeadersToAnonymize.includes(key.toLowerCase())) {
                anonymized[key] = '***';
            }
        });
        return anonymized;
    }
    anonymizeQueryParams(params) {
        const defaultParamsToAnonymize = ['key', 'api_key', 'apikey', 'token', 'access_token'];
        const paramsToAnonymize = this.config.anonymizeQueryParams !== undefined
            ? this.config.anonymizeQueryParams
            : defaultParamsToAnonymize;
        if (paramsToAnonymize.length === 0) {
            return params;
        }
        const anonymized = { ...params };
        const lowerCaseParamsToAnonymize = paramsToAnonymize.map((p) => p.toLowerCase());
        Object.keys(anonymized).forEach(key => {
            if (lowerCaseParamsToAnonymize.includes(key.toLowerCase())) {
                anonymized[key] = '***';
            }
        });
        return anonymized;
    }
    getHTTPClient() {
        return this.httpClient;
    }
    async reloadMockData(syncFromProject = true) {
        // If provider has a reload method, use it (for ExpoFileSystemProvider with caching)
        // For HybridProvider, this will also sync files from project folder to device
        if (this.databaseProvider && typeof this.databaseProvider.reload === 'function') {
            if (syncFromProject && typeof this.databaseProvider.reload === 'function') {
                // Pass syncFromProject flag if provider supports it (HybridProvider)
                await this.databaseProvider.reload(syncFromProject);
            }
            else {
                await this.databaseProvider.reload();
            }
        }
        else {
            // Fallback: try to load mock data if method exists
            if (typeof this.loadMockData === 'function') {
                this.loadMockData();
            }
        }
    }
    clearStaleCacheEntries() {
        return 0; // No cache in fetch implementation
    }
    async clearAllMocks() {
        if (this.databaseProvider && typeof this.databaseProvider.clearAll === 'function') {
            await this.databaseProvider.clearAll();
        }
        else {
            console.warn('[Mockifyer-Fetch] Provider does not support clearAll()');
        }
    }
}
function setupMockifyer(config) {
    var _a, _b;
    console.log('[Mockifyer-Fetch] 🚀 setupMockifyer called with config:', JSON.stringify({
        generateTests: config.generateTests,
        recordMode: config.recordMode,
        mockDataPath: config.mockDataPath,
        databaseProvider: (_a = config.databaseProvider) === null || _a === void 0 ? void 0 : _a.type
    }, null, 2));
    // Set environment variables for Metro middleware to read test generation config
    // This allows Metro middleware (which runs in Node.js) to generate tests
    // when Hybrid Provider saves mocks via Metro endpoint
    if ((_b = config.generateTests) === null || _b === void 0 ? void 0 : _b.enabled) {
        process.env.MOCKIFYER_GENERATE_TESTS = 'true';
        if (config.generateTests.framework) {
            process.env.MOCKIFYER_TEST_FRAMEWORK = config.generateTests.framework;
        }
        if (config.generateTests.outputPath) {
            process.env.MOCKIFYER_TEST_OUTPUT_PATH = config.generateTests.outputPath;
        }
        if (config.generateTests.testPattern) {
            process.env.MOCKIFYER_TEST_PATTERN = config.generateTests.testPattern;
        }
        if (config.generateTests.includeSetup === false) {
            process.env.MOCKIFYER_TEST_INCLUDE_SETUP = 'false';
        }
        if (config.generateTests.groupBy) {
            process.env.MOCKIFYER_TEST_GROUP_BY = config.generateTests.groupBy;
        }
        if (config.generateTests.uniqueTestsPerEndpoint) {
            process.env.MOCKIFYER_UNIQUE_TESTS_PER_ENDPOINT = 'true';
        }
    }
    (0, mockifyer_core_1.initializeDateManipulation)(config);
    (0, mockifyer_core_1.initializeScenario)(config);
    console.log('[Mockifyer-Fetch] 🚀 After initializeScenario - config:', JSON.stringify({
        generateTests: config.generateTests,
        recordMode: config.recordMode
    }, null, 2));
    const mockifyer = new MockifyerClass(config);
    const httpClient = mockifyer.getHTTPClient();
    // Always store original fetch (even if not patching global)
    let originalFetch;
    if (global.__mockifyer_original_fetch) {
        originalFetch = global.__mockifyer_original_fetch;
    }
    else {
        originalFetch = global.fetch;
        global.__mockifyer_original_fetch = originalFetch;
    }
    const fetchClient = httpClient;
    if (fetchClient && typeof fetchClient.performRequest === 'function') {
        fetchClient._originalFetch = originalFetch;
    }
    // Patch global fetch if useGlobalFetch is true
    if (config.useGlobalFetch) {
        const mockifyerInstance = mockifyer;
        const originalFetchForPatched = global.__mockifyer_original_fetch || originalFetch;
        global.fetch = async function (input, init) {
            var _a;
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
            const method = (init === null || init === void 0 ? void 0 : init.method) || 'GET';
            const headers = (init === null || init === void 0 ? void 0 : init.headers) || {};
            const body = init === null || init === void 0 ? void 0 : init.body;
            // Skip Mockifyer sync endpoints and Resend API to prevent infinite loops
            if (url.includes('/mockifyer-save') || url.includes('/mockifyer-clear') || url.includes('/mockifyer-sync') || url.includes('api.resend.com')) {
                return await originalFetchForPatched(input, init);
            }
            const simpleRequestKey = `${method}:${url}`;
            const isProcessing = (_a = mockifyerInstance.processingRequests) === null || _a === void 0 ? void 0 : _a.has(simpleRequestKey);
            if (isProcessing) {
                return await originalFetchForPatched(input, init);
            }
            let params = undefined;
            let baseUrl = url;
            try {
                const urlObj = new URL(url);
                if (urlObj.search) {
                    params = {};
                    urlObj.searchParams.forEach((value, key) => {
                        params[key] = value;
                    });
                    urlObj.search = '';
                    baseUrl = urlObj.toString();
                }
            }
            catch (error) {
                // URL parsing failed, use URL as-is
            }
            let headersObj = {};
            if (headers instanceof Headers) {
                headers.forEach((value, key) => {
                    headersObj[key] = value;
                });
            }
            else if (Array.isArray(headers)) {
                headers.forEach(([key, value]) => {
                    headersObj[key] = value;
                });
            }
            else {
                headersObj = headers;
            }
            try {
                const requestConfig = {
                    url: baseUrl,
                    method: method,
                    headers: headersObj,
                    params: params,
                    data: body ? (typeof body === 'string' ? (body.startsWith('{') || body.startsWith('[') ? JSON.parse(body) : body) : body) : undefined
                };
                const response = await httpClient.request(requestConfig);
                const responseHeaders = new Headers();
                // Copy all headers from response, ensuring x-mockifyer header is included if present
                if (response.headers) {
                    Object.entries(response.headers).forEach(([key, value]) => {
                        if (value !== undefined && value !== null) {
                            responseHeaders.set(key, String(value));
                        }
                    });
                    // Debug: Verify x-mockifyer header is present
                    if (response.headers['x-mockifyer']) {
                        console.log('[Mockifyer-Fetch] ✅ x-mockifyer header found in response:', response.headers['x-mockifyer']);
                    }
                    else {
                        console.warn('[Mockifyer-Fetch] ⚠️ x-mockifyer header NOT found in response.headers');
                        console.warn('[Mockifyer-Fetch] Available headers:', Object.keys(response.headers));
                    }
                }
                else {
                    console.warn('[Mockifyer-Fetch] ⚠️ response.headers is undefined/null');
                }
                const responseBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
                return new Response(responseBody, {
                    status: response.status,
                    statusText: response.statusText || '',
                    headers: responseHeaders
                });
            }
            catch (error) {
                if (error.response) {
                    const responseHeaders = new Headers();
                    Object.entries(error.response.headers || {}).forEach(([key, value]) => {
                        responseHeaders.set(key, String(value));
                    });
                    const errorBody = typeof error.response.data === 'string'
                        ? error.response.data
                        : JSON.stringify(error.response.data);
                    return new Response(errorBody, {
                        status: error.response.status,
                        statusText: error.response.statusText || '',
                        headers: responseHeaders
                    });
                }
                throw error;
            }
        };
    }
    const extendedClient = httpClient;
    extendedClient.reloadMockData = async () => await mockifyer.reloadMockData();
    extendedClient.clearStaleCacheEntries = () => mockifyer.clearStaleCacheEntries();
    extendedClient.clearAllMocks = () => mockifyer.clearAllMocks();
    return extendedClient;
}
// Re-export types from core
__exportStar(require("@sgedda/mockifyer-core"), exports);
// Export React Native helpers
__exportStar(require("./react-native"), exports);
