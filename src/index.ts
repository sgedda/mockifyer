import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosHeaders } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import path from 'path';
import { MockifyerConfig, MockData, StoredRequest, StoredResponse } from './types';
import { initializeDateManipulation } from './utils/date';
import { createHTTPClient, HTTPClientConfig } from './clients/http-client-factory';
import { HTTPClient, HTTPResponse } from './types/http-client';
import { 
  generateRequestKey as generateRequestKeyUtil,
  CachedMockData 
} from './utils/mock-matcher';

class MockifyerClass {
  private config: MockifyerConfig;
  private mockAdapter?: MockAdapter;
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
    
    this.config = config;
    this.ensureMockDataDirectory();
    
    // Create HTTP client based on configuration
    const httpClientConfig: HTTPClientConfig = {
      type: config.httpClientType || 'axios',
      baseUrl: config.baseUrl,
      defaultHeaders: config.defaultHeaders,
      axiosInstance: config.axiosInstance
    };
    
    this.httpClient = createHTTPClient(httpClientConfig);
    
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
    // CRITICAL: Log the full request object to see what we have
    console.log(`[Mockifyer] 🔍 findBestMatchingMock - FULL REQUEST OBJECT:`, JSON.stringify({
      method: request.method,
      url: request.url,
      hasData: !!request.data,
      dataType: typeof request.data,
      data: request.data, // Include full data object
      queryParams: request.queryParams
    }, null, 2).substring(0, 500));
    
    const requestKey = this.generateRequestKey(request);
    
    console.log(`[Mockifyer] findBestMatchingMock called with:`, {
      url: request.url,
      method: request.method,
      queryParams: request.queryParams,
      hasData: !!request.data,
      dataType: typeof request.data,
      dataPreview: request.data ? (typeof request.data === 'string' ? request.data.substring(0, 100) : JSON.stringify(request.data).substring(0, 100)) : 'undefined',
      requestKey: requestKey.substring(0, 300) // Show more of the key
    });
    
    // Always read directly from files (no cache)
    console.log('[Mockifyer] Reading directly from files (cache disabled)');
    return this.findBestMatchingMockFromFiles(request);
  }

  /**
   * Find best matching mock by reading directly from files (no cache, reads on each request)
   */
  private findBestMatchingMockFromFiles(request: StoredRequest): CachedMockData | undefined {
    if (!fs.existsSync(this.config.mockDataPath)) {
      console.log('[Mockifyer] Mock data directory does not exist:', this.config.mockDataPath);
      return undefined;
    }

    const files = fs.readdirSync(this.config.mockDataPath)
      .filter(file => file.endsWith('.json'));

    const requestKey = this.generateRequestKey(request);
    let exactMatch: CachedMockData | undefined;
    let similarMatch: CachedMockData | undefined;
    
    // Read files one by one and check for matches (no cache structure)
    for (const file of files) {
      try {
        const filePath = path.join(this.config.mockDataPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const mockData: MockData = JSON.parse(fileContent);
        
        // Skip files that don't have a valid request property
        if (!mockData || !mockData.request || typeof mockData.request !== 'object') {
          console.warn(`[Mockifyer] Skipping invalid mock file (missing or invalid request): ${file}`);
          continue;
        }
        
        // Additional safety check - ensure request has required properties
        if (!mockData.request.url) {
          console.warn(`[Mockifyer] Skipping invalid mock file (request missing url): ${file}`);
          continue;
        }
        
        let mockKey: string;
        try {
          mockKey = this.generateRequestKey(mockData.request);
        } catch (error) {
          console.warn(`[Mockifyer] Error generating key for mock file ${file}:`, error);
          continue;
        }
        
        // Check for exact match
        if (mockKey === requestKey) {
          exactMatch = {
            mockData,
            filename: file,
            filePath: filePath
          };
          break; // Exact match found, no need to continue
        }
        
        // If no exact match yet and similar matching is enabled, check for similar match
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
            // Check if path and method match
            try {
              const requestUrl = new URL(request.url);
              const mockUrl = new URL(mockData.request.url);
              const requestPath = requestUrl.pathname;
              const mockPath = mockUrl.pathname;
              
              if (mockPath === requestPath && 
                  (mockData.request.method || 'GET').toUpperCase() === (request.method || 'GET').toUpperCase()) {
                
                // Check if required parameters match (if configured)
                if (this.config.similarMatchRequiredParams && this.config.similarMatchRequiredParams.length > 0) {
                  const requestParams = request.queryParams || {};
                  const mockParams = mockData.request.queryParams || {};
                  const allRequiredMatch = this.config.similarMatchRequiredParams.every(paramName => {
                    const requestValue = requestParams[paramName];
                    const mockValue = mockParams[paramName];
                    if (requestValue === undefined && mockValue === undefined) return true;
                    return String(requestValue || '') === String(mockValue || '');
                  });
                  
                  if (!allRequiredMatch) {
                    continue; // Required parameter differs, skip this mock
                  }
                }
                
                similarMatch = {
                  mockData,
                  filename: file,
                  filePath: filePath
                };
              }
            } catch (e) {
              // Invalid URL, skip
              continue;
            }
          }
        }
      } catch (error) {
        console.warn(`[Mockifyer] Failed to load mock file ${file}:`, error);
      }
    }

    const result = exactMatch || similarMatch;
    
    if (result) {
      if (exactMatch) {
        console.log(`[Mockifyer] Using exact mock match (from file) for ${requestKey}`);
      } else {
        console.log(`[Mockifyer] Using similar mock match (from file) for ${requestKey}`);
      }
    } else {
      console.log(`[Mockifyer] No mock found in ${files.length} files for: ${requestKey}`);
    }

    return result;
  }

  private loadMockData(): void {
    console.log('[Mockifyer] Loading mock data from:', this.config.mockDataPath);
    console.log('[Mockifyer] Cache disabled - will read from files on each request');
    
    if (!fs.existsSync(this.config.mockDataPath)) {
      console.log('[Mockifyer] Mock data directory does not exist:', this.config.mockDataPath);
    } else {
      const files = fs.readdirSync(this.config.mockDataPath)
        .filter(file => file.endsWith('.json'));
      console.log('[Mockifyer] Found', files.length, 'mock files (will read on demand)');
    }
  }

  private setupMockResponses(): void {
    // Add request interceptor to handle mock responses
    this.httpClient.interceptors.request.use(async (config) => {
      // Debug: Log what we receive in the interceptor
      console.log('[Mockifyer] 📥 Interceptor received config:', {
        method: config.method,
        url: config.url,
        hasData: !!config.data,
        dataType: typeof config.data,
        dataIsString: typeof config.data === 'string',
        dataIsObject: typeof config.data === 'object' && config.data !== null,
        dataKeys: typeof config.data === 'object' && config.data !== null ? Object.keys(config.data) : 'N/A',
        dataPreview: typeof config.data === 'string' 
          ? config.data.substring(0, 100) 
          : typeof config.data === 'object' 
            ? JSON.stringify(config.data).substring(0, 100)
            : String(config.data).substring(0, 100)
      });

      // CRITICAL: Log data before creating request to debug GraphQL
      if (config.method === 'POST' && config.url && config.url.includes('graphql')) {
        console.log('[Mockifyer] 🚨 GRAPHQL DEBUG - config.data:', {
          exists: !!config.data,
          type: typeof config.data,
          isString: typeof config.data === 'string',
          isObject: typeof config.data === 'object' && config.data !== null,
          value: config.data ? (typeof config.data === 'string' ? config.data.substring(0, 200) : JSON.stringify(config.data).substring(0, 200)) : 'UNDEFINED'
        });
      }

      const request: StoredRequest = {
        method: config.method || 'GET',
        url: config.url || '',
        headers: config.headers || {},
        data: config.data,
        queryParams: config.params
      };

      // CRITICAL: Log request data after creation
      if (request.method === 'POST' && request.url && request.url.includes('graphql')) {
        console.log('[Mockifyer] 🚨 GRAPHQL DEBUG - request.data:', {
          exists: !!request.data,
          type: typeof request.data,
          value: request.data ? (typeof request.data === 'string' ? request.data.substring(0, 200) : JSON.stringify(request.data).substring(0, 200)) : 'UNDEFINED'
        });
      }

      // Debug logging for GraphQL requests
      if (request.method === 'POST' && request.data) {
        try {
          let bodyData = request.data;
          if (typeof request.data === 'string') {
            try {
              bodyData = JSON.parse(request.data);
            } catch (e) {
              // Not JSON
            }
          }
          if (typeof bodyData === 'object' && bodyData !== null && bodyData.query) {
            console.log('[Mockifyer] 🔷 GraphQL Request (mock mode):', {
              url: request.url,
              query: bodyData.query.substring(0, 100) + '...',
              variables: bodyData.variables,
              variablesType: typeof bodyData.variables
            });
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }

      const requestKey = this.generateRequestKey(request);
      console.log(`[Mockifyer] 🔑 Generated request key: ${requestKey.substring(0, 200)}${requestKey.length > 200 ? '...' : ''}`);
      console.log(`[Mockifyer] 📊 Request details for key generation:`, {
        method: request.method,
        url: request.url,
        hasData: !!request.data,
        dataType: typeof request.data
      });

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
        const axiosHeaders = new AxiosHeaders();
        Object.entries(responseHeaders).forEach(([key, value]) => {
          axiosHeaders.set(key, value);
        });
        
        const mockResponse: AxiosResponse = {
          data: mockData.response.data,
          status: mockData.response.status,
          statusText: 'OK',
          headers: axiosHeaders,
          config: config as any, // AxiosResponse expects InternalAxiosRequestConfig
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
            console.log('[Mockifyer] Mock response headers forEach:', typeof (mockResponse.headers as any).forEach);
            return Promise.resolve(mockResponse);
          }
        } as any;
      }

      if (this.config.failOnMissingMock) {
        throw new Error(`No mock data found for request: ${this.generateRequestKey(request)}`);
      }

      return config;
    });
  }

  private setupInterceptors(): void {
    // In record mode, only check for mocks if recordSameEndpoints is false
    // This allows re-recording when recordSameEndpoints is true
    // When recordSameEndpoints is false, use existing mocks to avoid unnecessary API calls
    if (this.config.recordSameEndpoints !== true) {
      this.httpClient.interceptors.request.use(async (config) => {
        // CRITICAL: This log proves new code is running
        console.log('[Mockifyer] 🆕 NEW CODE RUNNING - Interceptor called for:', config.method, config.url);
        
        // CRITICAL DEBUG: Log what we receive
        if (config.method === 'POST' && config.url && config.url.includes('graphql')) {
          console.log('[Mockifyer] 🚨 SETUPINTERCEPTORS - config received:', {
            method: config.method,
            url: config.url,
            hasData: !!config.data,
            dataType: typeof config.data,
            dataValue: config.data ? (typeof config.data === 'string' ? config.data.substring(0, 200) : JSON.stringify(config.data).substring(0, 200)) : 'UNDEFINED',
            allConfigKeys: Object.keys(config)
          });
        }

        // CRITICAL: Log config.data BEFORE creating request
        if (config.method === 'POST' && config.url && config.url.includes('graphql')) {
          console.log('[Mockifyer] 🚨 BEFORE creating request - config.data:', {
            exists: !!config.data,
            type: typeof config.data,
            value: config.data ? (typeof config.data === 'string' ? config.data.substring(0, 300) : JSON.stringify(config.data).substring(0, 300)) : 'UNDEFINED',
            allConfigKeys: Object.keys(config)
          });
        }

        const request: StoredRequest = {
          method: config.method || 'GET',
          url: config.url || '',
          headers: config.headers || {},
          data: config.data, // This should include the GraphQL query and variables
          queryParams: config.params
        };

        // CRITICAL DEBUG: Log what we create
        if (request.method === 'POST' && request.url && request.url.includes('graphql')) {
          console.log('[Mockifyer] 🚨 AFTER creating request - request.data:', {
            method: request.method,
            url: request.url,
            hasData: !!request.data,
            dataType: typeof request.data,
            dataValue: request.data ? (typeof request.data === 'string' ? request.data.substring(0, 300) : JSON.stringify(request.data).substring(0, 300)) : 'UNDEFINED',
            fullRequest: JSON.stringify(request).substring(0, 500)
          });
        }

        // Debug logging for GraphQL requests
        if (request.method === 'POST' && request.data) {
          try {
            let bodyData = request.data;
            if (typeof request.data === 'string') {
              try {
                bodyData = JSON.parse(request.data);
              } catch (e) {
                // Not JSON
              }
            }
            if (typeof bodyData === 'object' && bodyData !== null && bodyData.query) {
              console.log('[Mockifyer] 🔷 GraphQL Request detected:', {
                url: request.url,
                query: bodyData.query.substring(0, 100) + '...',
                variables: bodyData.variables,
                variablesType: typeof bodyData.variables,
                variablesKeys: bodyData.variables ? Object.keys(bodyData.variables) : []
              });
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }

        const requestKey = this.generateRequestKey(request);
        
        // Prevent infinite loops - if we're already processing this request, skip
        if (this.processingRequests.has(requestKey)) {
          console.log(`[Mockifyer] ⚠️ Already processing ${requestKey}, skipping to prevent infinite loop`);
          return config;
        }
        
        console.log(`[Mockifyer] 🔍 Processing request: ${requestKey}`);
        if (request.method === 'POST' && request.data) {
          console.log(`[Mockifyer] 📦 Request data type: ${typeof request.data}, isString: ${typeof request.data === 'string'}`);
        }
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

          const axiosHeaders = new AxiosHeaders();
          Object.entries(responseHeaders).forEach(([key, value]) => {
            axiosHeaders.set(key, value);
          });

          const mockResponse: AxiosResponse = {
            data: mockData.response.data,
            status: mockData.response.status,
            statusText: 'OK',
            headers: axiosHeaders,
            config: config as any,
            request: {}
          };

            console.log(`[Mockifyer] ✅ Found mock, returning mock response for ${requestKey}`);
            
            const result = {
              ...config,
              adapter: () => {
                console.log(`[Mockifyer] 📦 Adapter called, returning mock response for ${requestKey}`);
                return Promise.resolve(mockResponse);
              }
            } as any;
            
            // Remove from processing set immediately after creating the result
            // This allows the same request to be made again later if needed
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
    } else {
      // recordSameEndpoints is true - always make real API calls, don't check for mocks
      console.log('[Mockifyer] recordSameEndpoints=true, will always make real API calls');
    }

    // Add response interceptor to record responses (only for real API calls)
    // Skip recording if this is a mocked response (has x-mockifyer header)
    this.httpClient.interceptors.response.use(
      (response) => {
        // Check if this is a mocked response - if so, don't record it
        const isMocked = response.headers && (
          (typeof (response.headers as any).get === 'function' && (response.headers as any).get('x-mockifyer') === 'true') ||
          (typeof response.headers === 'object' && !Array.isArray(response.headers) && (response.headers as any)['x-mockifyer'] === 'true')
        );
        
        if (isMocked) {
          console.log('[Mockifyer] Skipping recording - this is a mocked response');
          return response;
        }
        
        const requestKey = this.generateRequestKey({
          method: response.config.method?.toUpperCase() || 'GET',
          url: response.config.url || '',
          headers: {},
          data: response.config.data, // CRITICAL: Include data for POST requests (GraphQL)
          queryParams: response.config.params || {}
        });
        
        console.log(`[Mockifyer] 📹 Recording response for: ${requestKey}`);
        this.saveResponse(response as HTTPResponse);
        return response;
      },
      (error) => {
        if (error.response) {
          // Check if this is a mocked error response
          const isMocked = error.response.headers && (
            (typeof (error.response.headers as any).get === 'function' && (error.response.headers as any).get('x-mockifyer') === 'true') ||
            (typeof error.response.headers === 'object' && !Array.isArray(error.response.headers) && (error.response.headers as any)['x-mockifyer'] === 'true')
          );
          
          if (isMocked) {
            console.log('[Mockifyer] Skipping recording - this is a mocked error response');
            return Promise.reject(error);
          }
          
          console.log('[Mockifyer] Recording error response for:', {
            method: error.response.config.method?.toUpperCase() || 'GET',
            url: error.response.config.url,
            status: error.response.status
          });
          this.saveResponse(error.response as HTTPResponse);
        }
        return Promise.reject(error);
      }
    );
  }

  private anonymizeHeaders(headers: Record<string, any>): Record<string, any> {
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
    
    const anonymized = { ...headers };
    const lowerCaseHeadersToAnonymize = headersToAnonymize.map(h => h.toLowerCase());
    
    // Anonymize headers (case-insensitive)
    for (const [key, value] of Object.entries(anonymized)) {
      if (value && typeof value === 'string' && lowerCaseHeadersToAnonymize.includes(key.toLowerCase())) {
        // Keep first 4 and last 4 characters if key is long enough, otherwise just show it's anonymized
        if (value.length > 8) {
          anonymized[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
        } else {
          anonymized[key] = '***ANONYMIZED***';
        }
      }
    }
    
    return anonymized;
  }

  private anonymizeQueryParams(queryParams: Record<string, any>): Record<string, any> {
    // Default query params to anonymize (common API key params)
    const defaultParamsToAnonymize = [
      'api_key',
      'apikey',
      'api-key',
      'key',
      'token',
      'access_token',
      'access-token',
      'auth_token',
      'auth-token',
      'secret',
      'password'
    ];
    
    const paramsToAnonymize = this.config.anonymizeQueryParams !== undefined
      ? this.config.anonymizeQueryParams
      : defaultParamsToAnonymize;
    
    // If explicitly set to empty array, don't anonymize
    if (paramsToAnonymize.length === 0) {
      return queryParams;
    }
    
    const anonymized = { ...queryParams };
    const lowerCaseParamsToAnonymize = paramsToAnonymize.map(p => p.toLowerCase());
    
    // Anonymize query params (case-insensitive)
    for (const [key, value] of Object.entries(anonymized)) {
      if (value != null && typeof value === 'string' && lowerCaseParamsToAnonymize.includes(key.toLowerCase())) {
        // Keep first 4 and last 4 characters if value is long enough, otherwise just show it's anonymized
        if (value.length > 8) {
          anonymized[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
        } else {
          anonymized[key] = '***ANONYMIZED***';
        }
      }
    }
    
    return anonymized;
  }

  private async saveResponse(response: HTTPResponse): Promise<void> {
    // Generate request key to check if we're already saving this response
    const tempRequest: StoredRequest = {
      method: response.config.method?.toUpperCase() || 'GET',
      url: response.config.url || '',
      headers: {},
      data: response.config.data, // CRITICAL: Include data for POST requests (GraphQL)
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
      let originalHeaders: Record<string, any> = {};
      if (response.config.headers) {
        if (typeof (response.config.headers as any).toJSON === 'function') {
          // AxiosHeaders instance
          originalHeaders = (response.config.headers as any).toJSON();
        } else if (typeof (response.config.headers as any).get === 'function') {
          // Headers-like object with get method
          const headersObj: Record<string, any> = {};
          const headers = response.config.headers as any;
          if (headers.forEach) {
            headers.forEach((value: any, key: string) => {
              headersObj[key] = value;
            });
          } else {
            // Fallback: try to iterate
            for (const key in headers) {
              if (headers.hasOwnProperty(key)) {
                headersObj[key] = headers[key];
              }
            }
          }
          originalHeaders = headersObj;
        } else {
          // Plain object
          originalHeaders = response.config.headers as Record<string, any>;
        }
      }
      
      // Anonymize headers and query params before saving
      const anonymizedHeaders = this.anonymizeHeaders(originalHeaders);
      const anonymizedQueryParams = this.anonymizeQueryParams(response.config.params || {});
      
      const request: StoredRequest = {
        method: response.config.method?.toUpperCase() || 'GET',
        url: response.config.url || '',
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

      const storedResponse: StoredResponse = {
        status: response.status,
        data: response.data,
        headers: response.headers as Record<string, string>
      };

      const mockData: MockData = {
        request,
        response: storedResponse,
        timestamp: new Date().toISOString(),
        scenario: this.config.scenarios?.default
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
      const filePath = path.join(this.config.mockDataPath, filename);
      
      // Write to file (no cache)
      fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
      console.log(`[Mockifyer] Saved new mock to file: ${filename}`);
    } finally {
      // Remove from saving set after save completes
      this.savingResponses.delete(requestKey);
    }
  }

  public getHTTPClient(): HTTPClient {
    return this.httpClient;
  }

  /**
   * Reload mock data from the filesystem
   * No-op since we don't use cache (files are read on each request)
   */
  public reloadMockData(): void {
    console.log('[Mockifyer] Reload called - no cache to reload (files read on demand)');
  }

  /**
   * Clear stale cache entries
   * No-op since we don't use cache
   */
  public clearStaleCacheEntries(): number {
    console.log('[Mockifyer] Clear stale cache called - no cache to clear');
    return 0;
  }
}

export interface MockifyerInstance extends HTTPClient {
  reloadMockData: () => void;
  clearStaleCacheEntries: () => number;
}

export function setupMockifyer(config: MockifyerConfig): MockifyerInstance {
  // Initialize date manipulation
  initializeDateManipulation(config);

  const mockifyer = new MockifyerClass(config);
  const httpClient = mockifyer.getHTTPClient();
  
  // Extend the HTTPClient with cache management methods
  return Object.assign(httpClient, {
    reloadMockData: () => mockifyer.reloadMockData(),
    clearStaleCacheEntries: () => mockifyer.clearStaleCacheEntries()
  }) as MockifyerInstance;
}

// Re-export date utilities and types
export * from './utils/date';
export * from './types';
export * from './clients/http-client-factory';
export * from './types/http-client'; 