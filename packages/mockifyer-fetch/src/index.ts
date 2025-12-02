// Fetch-only Mockifyer implementation
// Conditionally import fs - will be undefined in React Native
let fs: typeof import('fs') | undefined;
let path: typeof import('path') | undefined;

try {
  // Try to require fs and path - will fail in React Native where they're stubbed
  fs = require('fs');
  path = require('path');
} catch (e) {
  // fs/path not available (React Native environment)
  fs = undefined;
  path = undefined;
}

// Import from core package
import {
  MockifyerConfig,
  MockData,
  StoredRequest,
  StoredResponse,
  HTTPClient,
  HTTPResponse,
  generateRequestKey as generateRequestKeyUtil,
  CachedMockData,
  initializeDateManipulation,
  DatabaseProvider,
  createProvider
} from '@sgedda/mockifyer-core';

import { FetchHTTPClient } from './clients/fetch-client';

class MockifyerClass {
  private config: MockifyerConfig;
  private httpClient: HTTPClient;
  private processingRequests: Set<string> = new Set();
  private savingResponses: Set<string> = new Set();
  private databaseProvider?: DatabaseProvider;

  constructor(config: MockifyerConfig) {
    // Validate database provider - filesystem, expo-filesystem, hybrid, and memory are supported
    if (config.databaseProvider && config.databaseProvider.type) {
      const supportedTypes = ['filesystem', 'expo-filesystem', 'hybrid', 'memory'];
      if (!supportedTypes.includes(config.databaseProvider.type)) {
        throw new Error(
          `Database provider type '${config.databaseProvider.type}' is not yet available for use. ` +
          `Supported types: ${supportedTypes.join(', ')}. ` +
          `Please use one of the supported provider types.`
        );
      }
    }
    
    // Validate and normalize conflicting settings
    if (config.recordMode && config.failOnMissingMock) {
      console.warn(
        '[Mockifyer] Warning: recordMode is true but failOnMissingMock is also set to true. ' +
        'failOnMissingMock is ignored in record mode (real API calls are made to record responses). ' +
        'Setting failOnMissingMock to false.'
      );
      config.failOnMissingMock = false;
    }
    
    // Validate conflicting similar match settings
    if (config.similarMatchIgnoreAllQueryParams && 
        config.similarMatchRequiredParams && 
        config.similarMatchRequiredParams.length > 0) {
      console.warn(
        '[Mockifyer-Fetch] Warning: Both similarMatchIgnoreAllQueryParams and similarMatchRequiredParams are set. ' +
        'similarMatchIgnoreAllQueryParams takes precedence and all query parameters will be ignored. ' +
        'similarMatchRequiredParams will be ignored.'
      );
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
    
    this.config = config;
    
    // Initialize database provider if specified
    if (config.databaseProvider && config.databaseProvider.type) {
      this.databaseProvider = createProvider(config.databaseProvider.type, config.databaseProvider);
      const initResult = this.databaseProvider.initialize();
      // Handle async initialization (expo-filesystem provider has async initialize)
      if (initResult instanceof Promise) {
        initResult.catch((error) => {
          console.error('[Mockifyer-Fetch] Error initializing database provider:', error);
        });
      }
    } else {
      // Fallback to Node.js filesystem
      this.ensureMockDataDirectory();
    }
    
    // Create fetch HTTP client
    this.httpClient = new FetchHTTPClient({ 
      baseUrl: config.baseUrl, 
      defaultHeaders: config.defaultHeaders 
    });
    
    if(!config.recordSameEndpoints) {
      this.loadMockData();
    }
    // Always set up mock response interceptor (to use existing mocks)
    this.setupMockResponses();
    
    // Set up response interceptor to save responses when recordMode is enabled
    this.setupResponseInterceptor();
  }

  private ensureMockDataDirectory(): void {
    // Only use fs if available (Node.js environment) and no database provider is set
    if (!fs || this.databaseProvider) {
      return;
    }
    if (!fs.existsSync(this.config.mockDataPath)) {
      fs.mkdirSync(this.config.mockDataPath, { recursive: true });
    }
  }

  private generateRequestKey(request: StoredRequest): string {
    return generateRequestKeyUtil(request);
  }

  private async findBestMatchingMock(request: StoredRequest): Promise<CachedMockData | undefined> {
    // CRITICAL: Never try to match sync endpoint requests - they should never be mocked
    const requestUrl = request?.url || '';
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

  private async findBestMatchingMockFromProvider(request: StoredRequest): Promise<CachedMockData | undefined> {
    if (!this.databaseProvider) {
      return undefined;
    }

    // CRITICAL: Never try to match sync endpoint requests - they should never be mocked
    const requestUrl = request?.url || '';
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

  private findBestMatchingMockFromFiles(request: StoredRequest): CachedMockData | undefined {
    // Only use fs if available (Node.js environment)
    // This method should never be called when using a database provider
    if (!fs || !path) {
      return undefined;
    }
    if (!fs.existsSync(this.config.mockDataPath)) {
      return undefined;
    }

    const files = fs.readdirSync(this.config.mockDataPath)
      .filter(file => file.endsWith('.json'));

    const requestKey = this.generateRequestKey(request);
    let exactMatch: CachedMockData | undefined;
    let similarMatch: CachedMockData | undefined;
    
    for (const file of files) {
      try {
        const filePath = path!.join(this.config.mockDataPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const mockData: MockData = JSON.parse(fileContent);
        
        if (!mockData || !mockData.request || typeof mockData.request !== 'object') {
          continue;
        }
        
        const mockKey = this.generateRequestKey(mockData.request);
        
        if (mockKey === requestKey) {
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
                             } catch {
                               return false;
                             }
                           })();
          
          if (!isGraphQL) {
            try {
              const requestUrl = new URL(request.url);
              const mockUrl = new URL(mockData.request.url);
              if (mockUrl.pathname === requestUrl.pathname && 
                  (mockData.request.method || 'GET').toUpperCase() === (request.method || 'GET').toUpperCase()) {
                
                // If ignoreAllQueryParams is set, skip query param checking entirely
                if (this.config.similarMatchIgnoreAllQueryParams) {
                  // Ignore all query params, match on path and method only
                } else if (this.config.similarMatchRequiredParams && this.config.similarMatchRequiredParams.length > 0) {
                  // Check if required parameters match (if configured)
                  const requestParams = request.queryParams || {};
                  const mockParams = mockData.request.queryParams || {};
                  
                  const allRequiredMatch = this.config.similarMatchRequiredParams.every((paramName: string) => {
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
            } catch (e) {
              continue;
            }
          }
        }
      } catch (error) {
        console.warn(`[Mockifyer] Failed to load mock file ${file}:`, error);
      }
    }

    return exactMatch || similarMatch;
  }

  private loadMockData(): void {
    // Skip if using database provider or fs not available
    if (this.databaseProvider || !fs) {
      return;
    }
    if (fs.existsSync(this.config.mockDataPath)) {
      fs.readdirSync(this.config.mockDataPath)
        .filter(file => file.endsWith('.json'));
    }
  }

  private setupMockResponses(): void {
    this.httpClient.interceptors.request.use(async (config: any) => {
      // CRITICAL: Completely bypass Mockifyer interception for sync endpoints
      // This prevents any Mockifyer processing (mocking, saving, etc.) for these endpoints
      const url = config.url || '';
      if (url.includes('/mockifyer-save') || url.includes('/mockifyer-clear') || url.includes('/mockifyer-sync')) {
        // Mark this request to completely skip Mockifyer processing
        (config as any).__mockifyer_skip_save = true;
        (config as any).__mockifyer_bypass = true;
        return config;
      }
      
      // Normalize empty params: treat {} the same as undefined for consistent matching
      const rawParams = config.params || {};
      const anonymizedQueryParams = this.anonymizeQueryParams(rawParams);
      const normalizedParams = anonymizedQueryParams && Object.keys(anonymizedQueryParams).length > 0 
        ? anonymizedQueryParams 
        : undefined;
      
      const request: StoredRequest = {
        method: config.method || 'GET',
        url: config.url || '',
        headers: config.headers || {},
        data: config.data,
        queryParams: normalizedParams
      };

      const requestKey = this.generateRequestKey(request);
      
      // Store request key for response interceptor
      (config as any).__mockifyer_requestKey = requestKey;
      
      const cachedMock = await this.findBestMatchingMock(request);
      
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
          config: config as any
        };
        
        return {
          ...config,
          __mockResponse: Promise.resolve(mockResponse),
          __mockifyer_requestKey: requestKey
        } as any;
      }

      if (this.config.failOnMissingMock) {
        throw new Error(`No mock data found for request: ${this.generateRequestKey(request)}`);
      }

      return config;
    });
  }

  private setupResponseInterceptor(): void {
    this.httpClient.interceptors.response.use(
      async (response: any) => {
        // CRITICAL: Check for skip flag FIRST (set by request interceptor for sync endpoints)
        // This completely bypasses Mockifyer interception for sync endpoints
        if ((response.config as any).__mockifyer_skip_save || (response.config as any).__mockifyer_bypass) {
          return response;
        }
        
        // CRITICAL: Skip Mockifyer sync endpoints to prevent infinite loops
        // Check multiple ways to get the URL in case response.config is undefined
        const url = response.config?.url || response.request?.responseURL || response.url || (response as any).config?.url || '';
        
        // CRITICAL: Check URL FIRST before any other processing
        if (url && (url.includes('/mockifyer-save') || url.includes('/mockifyer-clear') || url.includes('/mockifyer-sync'))) {
          // Mark as bypassed to prevent any further processing
          (response.config as any).__mockifyer_skip_save = true;
          (response.config as any).__mockifyer_bypass = true;
          return response;
        }
        
        // Clean up processing requests tracking
        const requestKey = (response.config as any).__mockifyer_requestKey;
        if (requestKey) {
          this.processingRequests.delete(requestKey);
        }
        
        // CRITICAL: Check response data for Metro rejection messages (defense in depth)
        // This catches any responses that might have gotten through
        try {
          let responseDataStr = '';
          let responseDataObj: any = null;
          
          if (typeof response.data === 'string') {
            responseDataStr = response.data;
            try {
              responseDataObj = JSON.parse(response.data);
            } catch (e) {
              // Not JSON, that's fine
            }
          } else if (response.data) {
            // Try to stringify, but handle circular references
            try {
              responseDataStr = JSON.stringify(response.data);
              responseDataObj = response.data;
            } catch (stringifyError) {
              // If stringify fails, try to get a string representation
              responseDataStr = String(response.data);
            }
          }
          
          // CRITICAL: Check for Metro rejection message
          const hasRejectionMessage = responseDataStr && (
            responseDataStr.includes('Cannot save Mockifyer sync endpoint') ||
            responseDataStr.includes('Cannot save Mockifyer sync endpoint requests')
          );
          
          const hasRejectionInObject = responseDataObj && (
            (responseDataObj.error && typeof responseDataObj.error === 'string' && 
             responseDataObj.error.includes('Cannot save Mockifyer sync endpoint')) ||
            (responseDataObj.success === false && responseDataObj.error)
          );
          
          if (hasRejectionMessage || hasRejectionInObject) {
            return response;
          }
          
          // CRITICAL: Check for sync endpoint URLs in response data
          if (responseDataStr && (
              responseDataStr.includes('/mockifyer-save') || 
              responseDataStr.includes('/mockifyer-clear') || 
              responseDataStr.includes('/mockifyer-sync'))) {
            console.log('[Mockifyer-Fetch] ⚠️ Bypassing Mockifyer - sync endpoint in response data');
            return response;
          }
        } catch (e) {
          // Ignore errors - continue processing
          console.warn('[Mockifyer-Fetch] Error checking response data:', e);
        }
        
        const isMocked = response.headers && (response.headers as any)['x-mockifyer'] === 'true';
        if (isMocked) {
          console.log('[Mockifyer-Fetch] Response is mocked, skipping save');
          return response;
        }
        
        // Only save if recordMode is enabled
        if (this.config.recordMode) {
          console.log('[Mockifyer-Fetch] ✅ recordMode enabled, saving response');
          console.log('[Mockifyer-Fetch] Response URL:', response.config?.url);
          console.log('[Mockifyer-Fetch] Response status:', response.status);
          await this.saveResponse(response);
        } else {
          console.log('[Mockifyer-Fetch] ⚠️ recordMode disabled, not saving response');
          console.log('[Mockifyer-Fetch] Current config.recordMode:', this.config.recordMode);
        }
        return response;
      },
      async (error: any) => {
        const requestKey = (error.config as any)?.__mockifyer_requestKey;
        if (requestKey) {
          this.processingRequests.delete(requestKey);
        }
        throw error;
      }
    );
  }

  private async saveResponse(response: HTTPResponse): Promise<void> {
    // CRITICAL: Check for bypass flags FIRST - if set, completely skip processing
    if ((response.config as any).__mockifyer_skip_save || (response.config as any).__mockifyer_bypass) {
      console.log('[Mockifyer-Fetch] ⚠️ saveResponse: BLOCKING - bypass flag set');
      return;
    }
    
    // CRITICAL: Skip saving responses from Mockifyer sync endpoints FIRST
    // Check multiple ways to get the URL in case response.config is undefined
    const url = response.config?.url || (response as any).request?.responseURL || (response as any).url || '';
    if (url && (url.includes('/mockifyer-save') || url.includes('/mockifyer-clear') || url.includes('/mockifyer-sync'))) {
      return;
    }
    
      // CRITICAL: Check response data for sync endpoint references and Metro rejection messages
      // This is a defense-in-depth measure
      try {
        let responseDataStr = '';
        if (typeof response.data === 'string') {
          responseDataStr = response.data;
        } else if (response.data) {
          try {
            responseDataStr = JSON.stringify(response.data);
          } catch (stringifyError) {
            responseDataStr = String(response.data);
          }
        }
      
        // CRITICAL: Check for Metro rejection message
      if (responseDataStr && responseDataStr.includes('Cannot save Mockifyer sync endpoint')) {
        return;
      }
      
      // CRITICAL: Check for sync endpoint URLs in response data
      if (responseDataStr && (
          responseDataStr.includes('/mockifyer-save') || 
          responseDataStr.includes('/mockifyer-clear') || 
          responseDataStr.includes('/mockifyer-sync'))) {
        return;
      }
    } catch (e) {
      // Ignore JSON stringify errors
      console.warn('[Mockifyer-Fetch] Error checking response data in saveResponse:', e);
    }
    
    // Normalize empty params: treat {} the same as undefined for consistent matching
    const rawParams = response.config.params || {};
    const normalizedParams = rawParams && Object.keys(rawParams).length > 0 ? rawParams : undefined;
    
    const requestKey = this.generateRequestKey({
      method: response.config.method?.toUpperCase() || 'GET',
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
      
      const mockData: MockData = {
        request: {
          method: response.config.method?.toUpperCase() || 'GET',
          url: response.config.url || '',
          headers: this.anonymizeHeaders(response.config.headers || {}),
          data: response.config.data,
          queryParams: normalizedParams
        },
        response: {
          status: response.status,
          data: response.data,
          headers: response.headers
        },
        timestamp: new Date().toISOString()
      };
      
      // Use database provider if available, otherwise fallback to filesystem
      if (this.databaseProvider) {
        try {
          await this.databaseProvider.save(mockData);
        } catch (error) {
          console.error(`[Mockifyer-Fetch] Error saving mock using ${this.config.databaseProvider?.type} provider:`, error);
          throw error;
        }
      } else if (fs && path) {
        // Fallback to Node.js filesystem (only if fs/path are available)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const urlParts = (response.config.url || '').replace(/https?:\/\//, '').split('/');
        const domain = urlParts[0].replace(/\./g, '_');
        const urlPathPart = urlParts.slice(1).join('_') || 'root';
        const filename = `${timestamp}_${response.config.method?.toUpperCase() || 'GET'}_${domain}_${urlPathPart}.json`;
        const filePath = path.join(this.config.mockDataPath, filename);
        fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
        console.log(`[Mockifyer] Saved new mock to file: ${filename}`);
      } else {
        console.warn('[Mockifyer] Cannot save mock: no database provider and fs/path not available');
      }
    } finally {
      this.savingResponses.delete(requestKey);
    }
  }

  private anonymizeHeaders(headers: Record<string, any>): Record<string, any> {
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
    const lowerCaseHeadersToAnonymize = headersToAnonymize.map((h: string) => h.toLowerCase());
    
    Object.keys(anonymized).forEach(key => {
      if (lowerCaseHeadersToAnonymize.includes(key.toLowerCase())) {
        anonymized[key] = '***';
      }
    });
    
    return anonymized;
  }

  private anonymizeQueryParams(params: Record<string, any>): Record<string, any> {
    const defaultParamsToAnonymize = ['key', 'api_key', 'apikey', 'token', 'access_token'];
    
    const paramsToAnonymize = this.config.anonymizeQueryParams !== undefined
      ? this.config.anonymizeQueryParams
      : defaultParamsToAnonymize;
    
    if (paramsToAnonymize.length === 0) {
      return params;
    }
    
    const anonymized = { ...params };
    const lowerCaseParamsToAnonymize = paramsToAnonymize.map((p: string) => p.toLowerCase());
    
    Object.keys(anonymized).forEach(key => {
      if (lowerCaseParamsToAnonymize.includes(key.toLowerCase())) {
        anonymized[key] = '***';
      }
    });
    
    return anonymized;
  }

  getHTTPClient(): HTTPClient {
    return this.httpClient;
  }

  async reloadMockData(syncFromProject: boolean = true): Promise<void> {
    // If provider has a reload method, use it (for ExpoFileSystemProvider with caching)
    // For HybridProvider, this will also sync files from project folder to device
    if (this.databaseProvider && typeof (this.databaseProvider as any).reload === 'function') {
      if (syncFromProject && typeof (this.databaseProvider as any).reload === 'function') {
        // Pass syncFromProject flag if provider supports it (HybridProvider)
        await (this.databaseProvider as any).reload(syncFromProject);
      } else {
        await (this.databaseProvider as any).reload();
      }
    } else {
      // Fallback: try to load mock data if method exists
      if (typeof (this as any).loadMockData === 'function') {
        (this as any).loadMockData();
      }
    }
  }

  clearStaleCacheEntries(): number {
    return 0; // No cache in fetch implementation
  }

  async clearAllMocks(): Promise<void> {
    if (this.databaseProvider && typeof this.databaseProvider.clearAll === 'function') {
      await this.databaseProvider.clearAll();
    } else {
      console.warn('[Mockifyer-Fetch] Provider does not support clearAll()');
    }
  }
}

export interface MockifyerInstance extends HTTPClient {
  reloadMockData: () => Promise<void>;
  clearStaleCacheEntries: () => number;
  clearAllMocks: () => Promise<void>;
}

export function setupMockifyer(config: MockifyerConfig): MockifyerInstance {
  initializeDateManipulation(config);

  const mockifyer = new MockifyerClass(config);
  const httpClient = mockifyer.getHTTPClient();
  
  // Always store original fetch (even if not patching global)
  let originalFetch: typeof fetch;
  if ((global as any).__mockifyer_original_fetch) {
    originalFetch = (global as any).__mockifyer_original_fetch;
  } else {
    originalFetch = global.fetch;
    (global as any).__mockifyer_original_fetch = originalFetch;
  }
  
  const fetchClient = httpClient as any;
  if (fetchClient && typeof fetchClient.performRequest === 'function') {
    fetchClient._originalFetch = originalFetch;
  }
  
  // Patch global fetch if useGlobalFetch is true
  if (config.useGlobalFetch) {
    const mockifyerInstance = mockifyer;
    const originalFetchForPatched = (global as any).__mockifyer_original_fetch || originalFetch;
    
    global.fetch = async function(input: string | Request | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || 'GET';
      const headers = init?.headers || {};
      const body = init?.body;
      
      // Skip Mockifyer sync endpoints to prevent infinite loops
      if (url.includes('/mockifyer-save') || url.includes('/mockifyer-clear') || url.includes('/mockifyer-sync')) {
        return await originalFetchForPatched(input, init);
      }
      
      const simpleRequestKey = `${method}:${url}`;
      const isProcessing = (mockifyerInstance as any).processingRequests?.has(simpleRequestKey);
      if (isProcessing) {
        return await originalFetchForPatched(input, init);
      }
      
      let params: Record<string, string> | undefined = undefined;
      let baseUrl = url;
      try {
        const urlObj = new URL(url);
        if (urlObj.search) {
          params = {};
          urlObj.searchParams.forEach((value, key) => {
            params![key] = value;
          });
          urlObj.search = '';
          baseUrl = urlObj.toString();
        }
      } catch (error) {
        // URL parsing failed, use URL as-is
      }
      
      let headersObj: Record<string, string> = {};
      if (headers instanceof Headers) {
        headers.forEach((value, key) => {
          headersObj[key] = value;
        });
      } else if (Array.isArray(headers)) {
        headers.forEach(([key, value]) => {
          headersObj[key] = value;
        });
      } else {
        headersObj = headers as Record<string, string>;
      }
      
      try {
        const requestConfig = {
          url: baseUrl,
          method: method as any,
          headers: headersObj,
          params: params,
          data: body ? (typeof body === 'string' ? (body.startsWith('{') || body.startsWith('[') ? JSON.parse(body) : body) : body) : undefined
        };
        
        const response = await httpClient.request(requestConfig);
        
        const responseHeaders = new Headers();
        Object.entries(response.headers || {}).forEach(([key, value]) => {
          responseHeaders.set(key, String(value));
        });
        
        const responseBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        
        return new Response(responseBody, {
          status: response.status,
          statusText: response.statusText || '',
          headers: responseHeaders
        });
      } catch (error: any) {
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
    } as typeof fetch;
  }
  
  const extendedClient = httpClient as MockifyerInstance;
  extendedClient.reloadMockData = async () => await mockifyer.reloadMockData();
  extendedClient.clearStaleCacheEntries = () => mockifyer.clearStaleCacheEntries();
  extendedClient.clearAllMocks = () => mockifyer.clearAllMocks();
  
  return extendedClient;
}

// Re-export types from core
export * from '@sgedda/mockifyer-core';

// Export React Native helpers
export * from './react-native';

