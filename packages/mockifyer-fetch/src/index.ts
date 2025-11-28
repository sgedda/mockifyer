// Fetch-only Mockifyer implementation
import fs from 'fs';
import path from 'path';

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
  initializeDateManipulation
} from '@sgedda/mockifyer-core';

import { FetchHTTPClient } from './clients/fetch-client';

class MockifyerClass {
  private config: MockifyerConfig;
  private httpClient: HTTPClient;
  private processingRequests: Set<string> = new Set();
  private savingResponses: Set<string> = new Set();

  constructor(config: MockifyerConfig) {
    // Validate and normalize conflicting settings
    if (config.recordMode && config.failOnMissingMock) {
      console.warn(
        '[Mockifyer] Warning: recordMode is true but failOnMissingMock is also set to true. ' +
        'failOnMissingMock is ignored in record mode (real API calls are made to record responses). ' +
        'Setting failOnMissingMock to false.'
      );
      config.failOnMissingMock = false;
    }
    
    // Auto-enable useSimilarMatch if similarMatchRequiredParams is set
    if (config.similarMatchRequiredParams && config.similarMatchRequiredParams.length > 0) {
      if (config.useSimilarMatch === undefined || config.useSimilarMatch === false) {
        console.log('[Mockifyer-Fetch] Auto-enabling useSimilarMatch because similarMatchRequiredParams is set');
        config.useSimilarMatch = true;
      }
    }
    
    this.config = config;
    this.ensureMockDataDirectory();
    
    // Create fetch HTTP client
    this.httpClient = new FetchHTTPClient({ 
      baseUrl: config.baseUrl, 
      defaultHeaders: config.defaultHeaders 
    });
    
    console.log('[Mockifyer] record mode:', config.recordMode);
    if(!config.recordSameEndpoints) {
      this.loadMockData();
    }
    if (!config.recordMode) {
      this.setupMockResponses();
    } else {
      this.setupInterceptors();
    }
  }

  private ensureMockDataDirectory(): void {
    if (!fs.existsSync(this.config.mockDataPath)) {
      fs.mkdirSync(this.config.mockDataPath, { recursive: true });
    }
  }

  private generateRequestKey(request: StoredRequest): string {
    return generateRequestKeyUtil(request);
  }

  private async findBestMatchingMock(request: StoredRequest): Promise<CachedMockData | undefined> {
    const requestKey = this.generateRequestKey(request);
    
    // Always read directly from files (no cache)
    return this.findBestMatchingMockFromFiles(request);
  }

  private findBestMatchingMockFromFiles(request: StoredRequest): CachedMockData | undefined {
    if (!fs.existsSync(this.config.mockDataPath)) {
      return undefined;
    }

    const files = fs.readdirSync(this.config.mockDataPath)
      .filter(file => file.endsWith('.json'));

    const requestKey = this.generateRequestKey(request);
    console.log('[Mockifyer-Fetch] findBestMatchingMockFromFiles - requestKey:', requestKey);
    console.log('[Mockifyer-Fetch] findBestMatchingMockFromFiles - request.queryParams:', request.queryParams);
    let exactMatch: CachedMockData | undefined;
    let similarMatch: CachedMockData | undefined;
    
    for (const file of files) {
      try {
        const filePath = path.join(this.config.mockDataPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const mockData: MockData = JSON.parse(fileContent);
        
        if (!mockData || !mockData.request || typeof mockData.request !== 'object') {
          continue;
        }
        
        const mockKey = this.generateRequestKey(mockData.request);
        console.log(`[Mockifyer-Fetch] Checking mock file ${file}: mockKey="${mockKey}", mock.queryParams:`, mockData.request.queryParams);
        
        if (mockKey === requestKey) {
          console.log('[Mockifyer-Fetch] ✅ Exact match found:', file);
          exactMatch = { mockData, filename: file, filePath };
          break;
        }
        
        if (!exactMatch && this.config.useSimilarMatch && !similarMatch) {
          try {
            const requestUrl = new URL(request.url);
            const mockUrl = new URL(mockData.request.url);
            if (mockUrl.pathname === requestUrl.pathname && 
                (mockData.request.method || 'GET').toUpperCase() === (request.method || 'GET').toUpperCase()) {
              
              // Check if required parameters match (if configured)
              if (this.config.similarMatchRequiredParams && this.config.similarMatchRequiredParams.length > 0) {
                const requestParams = request.queryParams || {};
                const mockParams = mockData.request.queryParams || {};
                
                console.log('[Mockifyer-Fetch] Checking similarMatchRequiredParams:', {
                  requiredParams: this.config.similarMatchRequiredParams,
                  requestParams,
                  mockParams,
                  requestUrl: request.url,
                  mockUrl: mockData.request.url
                });
                
                const allRequiredMatch = this.config.similarMatchRequiredParams.every((paramName: string) => {
                  const requestValue = requestParams[paramName];
                  const mockValue = mockParams[paramName];
                  const matches = requestValue === undefined && mockValue === undefined 
                    ? true 
                    : String(requestValue || '') === String(mockValue || '');
                  
                  console.log(`[Mockifyer-Fetch] Param "${paramName}": request="${requestValue}" vs mock="${mockValue}" => ${matches ? 'MATCH' : 'NO MATCH'}`);
                  
                  return matches;
                });
                
                if (!allRequiredMatch) {
                  console.log('[Mockifyer-Fetch] ❌ Similar match rejected: required params do not match');
                  continue; // Required parameter differs, skip this mock
                }
                
                console.log('[Mockifyer-Fetch] ✅ All required params match, using similar match');
              }
              
              similarMatch = { mockData, filename: file, filePath };
            }
          } catch (e) {
            continue;
          }
        }
      } catch (error) {
        console.warn(`[Mockifyer] Failed to load mock file ${file}:`, error);
      }
    }

    return exactMatch || similarMatch;
  }

  private loadMockData(): void {
    console.log('[Mockifyer] Loading mock data from:', this.config.mockDataPath);
    if (!fs.existsSync(this.config.mockDataPath)) {
      console.log('[Mockifyer] Mock data directory does not exist:', this.config.mockDataPath);
    } else {
      const files = fs.readdirSync(this.config.mockDataPath)
        .filter(file => file.endsWith('.json'));
      console.log('[Mockifyer] Found', files.length, 'mock files');
    }
  }

  private setupMockResponses(): void {
    this.httpClient.interceptors.request.use(async (config: any) => {
      // Normalize empty params: treat {} the same as undefined for consistent matching
      const rawParams = config.params || {};
      console.log('[Mockifyer-Fetch] setupMockResponses - rawParams:', rawParams);
      const anonymizedQueryParams = this.anonymizeQueryParams(rawParams);
      console.log('[Mockifyer-Fetch] setupMockResponses - anonymizedQueryParams:', anonymizedQueryParams);
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

      console.log('[Mockifyer-Fetch] setupMockResponses - request.queryParams:', request.queryParams);
      const requestKey = this.generateRequestKey(request);
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
          __mockResponse: Promise.resolve(mockResponse)
        } as any;
      }

      if (this.config.failOnMissingMock) {
        throw new Error(`No mock data found for request: ${this.generateRequestKey(request)}`);
      }

      return config;
    });
  }

  private setupInterceptors(): void {
    if (this.config.recordSameEndpoints !== true) {
      this.httpClient.interceptors.request.use(async (config: any) => {
        const anonymizedQueryParams = this.anonymizeQueryParams(config.params || {});
        
        const request: StoredRequest = {
          method: config.method || 'GET',
          url: config.url || '',
          headers: config.headers || {},
          data: config.data,
          queryParams: anonymizedQueryParams
        };

        const requestKey = this.generateRequestKey(request);
        
        if (this.processingRequests.has(requestKey)) {
          return config;
        }
        
        this.processingRequests.add(requestKey);
        
        try {
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
            
            this.processingRequests.delete(requestKey);
            
            return {
              ...config,
              __mockResponse: Promise.resolve(mockResponse),
              __mockifyer_requestKey: requestKey
            } as any;
          }
        } catch (error) {
          this.processingRequests.delete(requestKey);
          throw error;
        }
        
        (config as any).__mockifyer_requestKey = requestKey;
        return config;
      });
    }

    this.httpClient.interceptors.response.use(
      async (response: any) => {
        const requestKey = (response.config as any).__mockifyer_requestKey;
        if (requestKey) {
          this.processingRequests.delete(requestKey);
        }
        
        const isMocked = response.headers && (response.headers as any)['x-mockifyer'] === 'true';
        if (isMocked) {
          return response;
        }
        
        await this.saveResponse(response);
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
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const urlParts = (response.config.url || '').replace(/https?:\/\//, '').split('/');
      const domain = urlParts[0].replace(/\./g, '_');
      const urlPathPart = urlParts.slice(1).join('_') || 'root';
      const filename = `${timestamp}_${response.config.method?.toUpperCase() || 'GET'}_${domain}_${urlPathPart}.json`;
      const filePath = path.join(this.config.mockDataPath, filename);
      
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
      
      fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
      console.log(`[Mockifyer] Saved new mock to file: ${filename}`);
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

  reloadMockData(): void {
    this.loadMockData();
  }

  clearStaleCacheEntries(): number {
    return 0; // No cache in fetch implementation
  }
}

export interface MockifyerInstance extends HTTPClient {
  reloadMockData: () => void;
  clearStaleCacheEntries: () => number;
}

export function setupMockifyer(config: MockifyerConfig): MockifyerInstance {
  console.log('[Mockifyer-Fetch] ⚡⚡⚡ setupMockifyer called:', config);
  initializeDateManipulation(config);

  const mockifyer = new MockifyerClass(config);
  const httpClient = mockifyer.getHTTPClient();
  
  // Always store original fetch (even if not patching global)
  let originalFetch: typeof fetch;
  if ((global as any).__mockifyer_original_fetch) {
    originalFetch = (global as any).__mockifyer_original_fetch;
    console.log('[Mockifyer] ✅ Using original fetch from global store');
  } else {
    originalFetch = global.fetch;
    (global as any).__mockifyer_original_fetch = originalFetch;
    console.log('[Mockifyer] ✅ Stored original fetch globally');
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
    
    console.log('[Mockifyer] Global fetch function patched');
  }
  
  const extendedClient = httpClient as MockifyerInstance;
  extendedClient.reloadMockData = () => mockifyer.reloadMockData();
  extendedClient.clearStaleCacheEntries = () => mockifyer.clearStaleCacheEntries();
  
  return extendedClient;
}

// Re-export types from core
export * from '@sgedda/mockifyer-core';

