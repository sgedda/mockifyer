// Use require to get the user's axios instance (from peerDependency)
// This ensures we use the same axios instance the user imports
const axios = require('axios');
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
// AxiosHeaders is used as a value (new AxiosHeaders()), so import it normally
import { AxiosHeaders } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import path from 'path';
import { MockifyerConfig, MockData, StoredRequest, StoredResponse } from './types';
import { initializeDateManipulation, prepareMockResponseBody, getCurrentDate } from '@sgedda/mockifyer-core';
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
    // Validate database provider - only filesystem is currently supported
    if (config.databaseProvider && config.databaseProvider.type && config.databaseProvider.type !== 'filesystem') {
      throw new Error(
        `Database provider type '${config.databaseProvider.type}' is not supported with mockifyer-axios. ` +
        `Use type 'filesystem' (or omit databaseProvider). ` +
        `For Redis or other providers, use @sgedda/mockifyer-fetch in Node.`
      );
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
    
    this.config = config;
    this.ensureMockDataDirectory();
    
    // Create HTTP client based on configuration
    const httpClientConfig: HTTPClientConfig = {
      type: config.httpClientType || 'axios',
      baseUrl: config.baseUrl,
      defaultHeaders: config.defaultHeaders,
      axiosInstance: config.axiosInstance
    };
    
    console.log('[Mockifyer] httpClientConfig', httpClientConfig);
    this.httpClient = createHTTPClient(httpClientConfig);
    console.log('this.httpClient', this.httpClient);
    
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
        // Check for null explicitly since typeof null === 'object' in JavaScript
        if (!mockData || !mockData.request || mockData.request === null || typeof mockData.request !== 'object') {
          console.warn(`[Mockifyer] Skipping invalid mock file (missing or invalid request): ${file}`, {
            hasMockData: !!mockData,
            hasRequest: !!mockData?.request,
            requestType: typeof mockData?.request,
            requestIsNull: mockData?.request === null
          });
          continue;
        }
        
        // Additional safety check - ensure request has required properties
        // Only skip if url is explicitly null or undefined (not empty string, as that will be caught by generateRequestKey)
        if (mockData.request.url === null || mockData.request.url === undefined) {
          console.warn(`[Mockifyer] Skipping invalid mock file (request missing url): ${file}`);
          continue;
        }
        
        // Double-check that request is actually an object before calling generateRequestKey
        if (typeof mockData.request !== 'object' || mockData.request === null || mockData.request === undefined) {
          console.warn(`[Mockifyer] Skipping invalid mock file (request is not a valid object): ${file}`, {
            requestType: typeof mockData.request,
            requestIsNull: mockData.request === null,
            requestIsUndefined: mockData.request === undefined
          });
          continue;
        }
        
        // Final safety check - ensure request has method property (required by generateRequestKey)
        if (!mockData.request || mockData.request.method === undefined) {
          console.warn(`[Mockifyer] Skipping invalid mock file (request missing method): ${file}`, {
            hasRequest: !!mockData.request,
            hasMethod: mockData.request?.method !== undefined
          });
          continue;
        }
        
        let mockKey: string;
        try {
          // One more defensive check right before calling
          if (!mockData.request || typeof mockData.request !== 'object') {
            throw new Error(`Request is invalid: ${typeof mockData.request}`);
          }
          mockKey = this.generateRequestKey(mockData.request);
        } catch (error: any) {
          // Log more details about the error to help debug
          console.warn(`[Mockifyer] Error generating key for mock file ${file}:`, {
            error: error?.message || error,
            requestUrl: mockData.request?.url,
            requestMethod: mockData.request?.method,
            requestType: typeof mockData.request,
            requestIsNull: mockData.request === null,
            requestIsUndefined: mockData.request === undefined,
            requestKeys: mockData.request ? Object.keys(mockData.request) : 'N/A'
          });
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

      // Anonymize query params before matching (same as when saving)
      const anonymizedQueryParams = this.anonymizeQueryParams(config.params || {});
      
      const request: StoredRequest = {
        method: config.method || 'GET',
        url: config.url || '',
        headers: config.headers || {},
        data: config.data,
        queryParams: anonymizedQueryParams
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

        console.log('[Mockifyer] Returning mock response with headers:', Object.keys(responseHeaders));
        console.log('[Mockifyer] Mock headers:', responseHeaders);
        
        // For fetch clients, set __mockResponse. For axios clients, set adapter
        if (this.config.httpClientType === 'fetch') {
          // Create HTTPResponse format for fetch client
          const mockResponse = {
            data: prepareMockResponseBody(mockData, getCurrentDate),
            status: mockData.response.status,
            statusText: 'OK',
            headers: responseHeaders,
            config: config as any
          };
          
          console.log('[Mockifyer] 📦 Setting __mockResponse for fetch client in setupMockResponses');
          
          return {
            ...config,
            __mockResponse: Promise.resolve(mockResponse)
          } as any;
        } else {
          // Axios client - use adapter
          const axiosHeaders = new AxiosHeaders();
          Object.entries(responseHeaders).forEach(([key, value]) => {
            axiosHeaders.set(key, value);
          });
          
          const mockResponse: AxiosResponse = {
            data: prepareMockResponseBody(mockData, getCurrentDate),
            status: mockData.response.status,
            statusText: 'OK',
            headers: axiosHeaders,
            config: config as any,
            request: {}
          };
          
          // Safely get keys from AxiosHeaders (it might not have .keys() method in all Axios versions)
          try {
            if (typeof (axiosHeaders as any).keys === 'function') {
              console.log('[Mockifyer] AxiosHeaders keys:', Array.from((axiosHeaders as any).keys()));
            } else {
              // Fallback: use Object.keys on the plain headers object
              console.log('[Mockifyer] AxiosHeaders keys:', Object.keys(responseHeaders));
            }
          } catch (e) {
            console.log('[Mockifyer] AxiosHeaders keys:', Object.keys(responseHeaders));
          }
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
        console.log('[Mockifyer] 🆕 NEW CODE RUNNING - Interceptor called for:', config.method, config.url, {
          hasParams: !!config.params,
          params: config.params,
          allKeys: Object.keys(config)
        });
        
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

        // Anonymize query params before matching (same as when saving)
        const anonymizedQueryParams = this.anonymizeQueryParams(config.params || {});
        
        const request: StoredRequest = {
          method: config.method || 'GET',
          url: config.url || '',
          headers: config.headers || {},
          data: config.data, // This should include the GraphQL query and variables
          queryParams: anonymizedQueryParams
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
          // CRITICAL: Preserve all config properties including params when returning early
          const returnConfig = { ...config };
          // Explicitly preserve params - they might be lost in the spread
          if (config.params) {
            returnConfig.params = config.params;
            console.log(`[Mockifyer] Preserved params in early return:`, returnConfig.params);
          }
          return returnConfig;
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

          console.log(`[Mockifyer] ✅ Found mock, returning mock response for ${requestKey}`);
          
          // For mocks, we can delete immediately since performRequest() won't be called
          // But keep it in the set briefly to prevent loops if the mock response triggers another request
          // We'll delete it when the mock response is actually returned (in BaseHTTPClient)
          
          // For fetch clients, set __mockResponse. For axios clients, set adapter
          if (this.config.httpClientType === 'fetch') {
            // Create HTTPResponse format for fetch client
            const mockResponse = {
              data: prepareMockResponseBody(mockData, getCurrentDate),
              status: mockData.response.status,
              statusText: 'OK', // StoredResponse doesn't have statusText, use default
              headers: mockData.response.headers || {},
              config: config as any
            };
            
            // Add mockifyer headers
            mockResponse.headers['x-mockifyer'] = 'true';
            mockResponse.headers['x-mockifyer-timestamp'] = mockData.timestamp;
            mockResponse.headers['x-mockifyer-filename'] = filename;
            mockResponse.headers['x-mockifyer-filepath'] = filePath;
            
            console.log(`[Mockifyer] 📦 Setting __mockResponse for fetch client`);
            
            // Store requestKey on config for cleanup
            const returnConfig = {
              ...config,
              __mockResponse: Promise.resolve(mockResponse),
              __mockifyer_requestKey: requestKey
            } as any;
            
            // For mocks, delete immediately since performRequest won't be called
            this.processingRequests.delete(requestKey);
            
            return returnConfig;
          } else {
            // Axios client - use adapter
            const axiosHeaders = new AxiosHeaders();
            const responseHeaders = {
              ...mockData.response.headers,
              'x-mockifyer': 'true',
              'x-mockifyer-timestamp': mockData.timestamp,
              'x-mockifyer-filename': filename,
              'x-mockifyer-filepath': filePath
            };
            Object.entries(responseHeaders).forEach(([key, value]) => {
              axiosHeaders.set(key, value);
            });

            const mockResponse: AxiosResponse = {
              data: prepareMockResponseBody(mockData, getCurrentDate),
              status: mockData.response.status,
              statusText: 'OK',
              headers: axiosHeaders,
              config: config as any,
              request: {}
            };
            
            return {
              ...config,
              adapter: () => {
                console.log(`[Mockifyer] 📦 Adapter called, returning mock response for ${requestKey}`);
                return Promise.resolve(mockResponse);
              }
            } as any;
          }
          }
          
          // No mock found - will make real API call (this is correct)
          console.log(`[Mockifyer] ❌ No mock found for ${requestKey}, will make real API call`);
          console.log(`[Mockifyer] Returning config with params:`, {
            url: config.url,
            method: config.method,
            hasParams: !!config.params,
            params: config.params,
            httpClientType: this.config.httpClientType,
            allKeys: Object.keys(config)
          });
          // CRITICAL: Don't delete from processingRequests here - wait until after performRequest completes
          // This prevents infinite loops when useGlobalFetch: true and performRequest calls patched fetch
          // We'll delete it in the response interceptor after the request completes
          
          // CRITICAL: Always preserve params - they're needed for performRequest to add them to the URL
          const returnConfig = { ...config };
          // Explicitly preserve params for fetch clients - even if undefined, preserve the property
          if (this.config.httpClientType === 'fetch') {
            // Always preserve params property, even if it's undefined
            returnConfig.params = config.params;
            console.log(`[Mockifyer] Return config has params:`, !!returnConfig.params, returnConfig.params);
            if (!returnConfig.params) {
              console.warn(`[Mockifyer] ⚠️ WARNING: params are missing from config! Original config had:`, {
                hasParams: !!config.params,
                params: config.params,
                allKeys: Object.keys(config)
              });
            }
          }
          // Store requestKey on config so response interceptor can clean it up
          (returnConfig as any).__mockifyer_requestKey = requestKey;
          // Store request start time for duration calculation
          (returnConfig as any).__mockifyer_startTime = Date.now();
          return returnConfig;
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
        console.log('[Mockifyer] 🎯 Response interceptor called!', {
          url: response.config?.url,
          status: response.status,
          hasConfig: !!response.config
        });
        
        // CRITICAL: Clean up processingRequests after request completes
        // This prevents infinite loops when useGlobalFetch: true
        const requestKey = (response.config as any).__mockifyer_requestKey;
        if (requestKey) {
          this.processingRequests.delete(requestKey);
          console.log(`[Mockifyer] ✅ Removed ${requestKey} from processingRequests after request completed`);
        }
        
        // Check if this is a mocked response - if so, don't record it
        const isMocked = response.headers && (
          (typeof (response.headers as any).get === 'function' && (response.headers as any).get('x-mockifyer') === 'true') ||
          (typeof response.headers === 'object' && !Array.isArray(response.headers) && (response.headers as any)['x-mockifyer'] === 'true')
        );
        
        if (isMocked) {
          console.log('[Mockifyer] Skipping recording - this is a mocked response');
          return response;
        }
        
        const requestKeyForRecording = this.generateRequestKey({
          method: response.config.method?.toUpperCase() || 'GET',
          url: response.config.url || '',
          headers: {},
          data: response.config.data, // CRITICAL: Include data for POST requests (GraphQL)
          queryParams: response.config.params || {}
        });
        
        console.log(`[Mockifyer] 📹 Recording response for: ${requestKeyForRecording}`);
        this.saveResponse(response as HTTPResponse);
        return response;
      },
      (error) => {
        // CRITICAL: Clean up processingRequests after request fails
        // This prevents infinite loops when useGlobalFetch: true
        if (error.config) {
          const requestKey = (error.config as any).__mockifyer_requestKey;
          if (requestKey) {
            this.processingRequests.delete(requestKey);
            console.log(`[Mockifyer] ✅ Removed ${requestKey} from processingRequests after request failed`);
          }
        }
        
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
      if (value != null && lowerCaseParamsToAnonymize.includes(key.toLowerCase())) {
        // Convert to string first, then anonymize
        const stringValue = String(value);
        // Keep first 4 and last 4 characters if value is long enough, otherwise just show it's anonymized
        if (stringValue.length > 8) {
          anonymized[key] = `${stringValue.substring(0, 4)}...${stringValue.substring(stringValue.length - 4)}`;
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


      const storedResponse: StoredResponse = {
        status: response.status,
        data: response.data,
        headers: response.headers as Record<string, string>
      };

      // Calculate request duration if start time is available
      const startTime = (response.config as any).__mockifyer_startTime;
      const duration = startTime ? Date.now() - startTime : undefined;

      const mockData: MockData = {
        request,
        response: storedResponse,
        timestamp: new Date().toISOString(),
        duration,
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
  console.log('[Mockifyer] ⚡⚡⚡ setupMockifyer called:', config);
  // Initialize date manipulation
  initializeDateManipulation(config);

  const mockifyer = new MockifyerClass(config);
  const httpClient = mockifyer.getHTTPClient();
  
  // If useGlobalAxios is true, patch the global axios instance
  if (config.useGlobalAxios && config.httpClientType !== 'fetch') {
    const axiosInstance = (httpClient as any).instance;
    const baseClient = httpClient as any;
    
    if (axiosInstance) {
      // CRITICAL: Use the axios instance passed by the user if provided
      // This ensures we use the EXACT same axios instance the user imports
      // If not provided, fall back to require('axios') which should resolve to the user's axios
      let globalAxios: any;
      
      if (config.axiosInstance) {
        // User explicitly passed axios instance - use it!
        globalAxios = config.axiosInstance;
        console.log('[Mockifyer] ✅ Using axios instance passed in config.axiosInstance');
      } else {
        // Try to get axios from require (should resolve to user's axios via peerDependency)
        try {
          const axiosModule = require('axios');
          globalAxios = axiosModule.default || axiosModule;
          console.log('[Mockifyer] Using axios from require("axios") (peerDependency)');
        } catch (e) {
          // Fallback to imported axios (shouldn't happen if peerDependency is set up correctly)
          console.warn('[Mockifyer] Could not require axios, using imported instance:', e);
          globalAxios = axios;
        }
      }
      
      console.log('[Mockifyer] Global axios instance:', {
        hasInterceptors: !!globalAxios?.interceptors,
        interceptorsType: typeof globalAxios?.interceptors,
        axiosType: typeof globalAxios,
        currentInterceptorCount: (globalAxios.interceptors.response as any).handlers?.length || 0
      });
      
      // CRITICAL: When useGlobalAxios is true, requests go through global axios,
      // so we need to add interceptors DIRECTLY to global axios, not to axiosInstance
      // The interceptors from BaseHTTPClient need to be added to global axios
      
      // Apply request interceptors from BaseHTTPClient directly to global axios
      if (baseClient.requestInterceptors && baseClient.requestInterceptors.length > 0) {
        baseClient.requestInterceptors.forEach((interceptor: any) => {
          if (interceptor.onFulfilled) {
            globalAxios.interceptors.request.use(
              async (config: any) => {
                return await interceptor.onFulfilled(config);
              },
              interceptor.onRejected
            );
          }
        });
      }
      
      // Apply response interceptors from BaseHTTPClient directly to global axios
      // CRITICAL: Add interceptors directly to global axios so they're called when axios.get() is used
      if (baseClient.responseInterceptors && baseClient.responseInterceptors.length > 0) {
        console.log('[Mockifyer] Adding response interceptors directly to global axios:', baseClient.responseInterceptors.length);
        baseClient.responseInterceptors.forEach((interceptor: any, index: number) => {
          if (interceptor.onFulfilled) {
            console.log(`[Mockifyer] Adding response interceptor ${index} to global axios`);
            // Use the same pattern as user's example - simple function declaration
            const interceptorId = globalAxios.interceptors.response.use(
              async function(axiosResponse: any) {
                console.log('[Mockifyer] 🎯🎯🎯 Global axios response interceptor called!', {
                  url: axiosResponse.config?.url,
                  status: axiosResponse.status
                });
                
                try {
                  // Convert Axios response to HTTPResponse format expected by Mockifyer interceptor
                  const httpResponse: HTTPResponse = {
                    data: axiosResponse.data,
                    status: axiosResponse.status,
                    statusText: axiosResponse.statusText || 'OK',
                    headers: (() => {
                      const headers: Record<string, string> = {};
                      if (axiosResponse.headers) {
                        if (typeof axiosResponse.headers.forEach === 'function') {
                          // AxiosHeaders instance
                          axiosResponse.headers.forEach((value: string, key: string) => {
                            headers[key.toLowerCase()] = String(value);
                          });
                        } else {
                          // Plain object
                          Object.entries(axiosResponse.headers).forEach(([key, value]) => {
                            headers[key.toLowerCase()] = String(value);
                          });
                        }
                      }
                      return headers;
                    })(),
                    config: axiosResponse.config || {}
                  };
                  
                  // Call the Mockifyer interceptor with HTTPResponse format
                  const result = await interceptor.onFulfilled(httpResponse);
                  
                  // Mockifyer interceptor returns HTTPResponse, but axios expects AxiosResponse
                  // So we need to merge the result back into the original axiosResponse
                  // Keep all original axiosResponse properties, only update what Mockifyer modified
                  if (result && typeof result === 'object') {
                    // Update data, status, statusText if modified
                    if (result.data !== undefined) axiosResponse.data = result.data;
                    if (result.status !== undefined) axiosResponse.status = result.status;
                    if (result.statusText !== undefined) axiosResponse.statusText = result.statusText;
                    
                    // Update headers if modified
                    if (result.headers && typeof result.headers === 'object') {
                      if (typeof axiosResponse.headers.forEach === 'function') {
                        // AxiosHeaders - update it
                        Object.entries(result.headers).forEach(([key, value]) => {
                          axiosResponse.headers.set(key, String(value));
                        });
                      } else {
                        // Plain object - merge
                        axiosResponse.headers = {
                          ...axiosResponse.headers,
                          ...result.headers
                        };
                      }
                    }
                  }
                  
                  // Return the axiosResponse (axios expects AxiosResponse format)
                  return axiosResponse;
                } catch (error) {
                  console.error('[Mockifyer] Error in response interceptor:', error);
                  throw error;
                }
              },
              async function(error: any) {
                if (interceptor.onRejected) {
                  return await interceptor.onRejected(error);
                }
                return Promise.reject(error);
              }
            );
            console.log(`[Mockifyer] Interceptor registered with ID: ${interceptorId}`);
          }
        });
        console.log('[Mockifyer] ✅ Response interceptors added to global axios');
        
        // Verify interceptors are registered
        const handlers = (globalAxios.interceptors.response as any).handlers || [];
        console.log('[Mockifyer] Verified: Global axios has', handlers.length, 'response interceptors registered');
      }
      
      // Copy adapter if it exists (for mock responses)
      if (axiosInstance.defaults && axiosInstance.defaults.adapter) {
        axios.defaults.adapter = axiosInstance.defaults.adapter;
      }
      
      console.log('[Mockifyer] Global axios configured with interceptors');
    } else {
      // Fallback: replace global axios methods with our client methods
      axios.get = function(url: string, config?: any) {
        return httpClient.get(url, config);
      } as any;
      
      axios.post = function(url: string, data?: any, config?: any) {
        return httpClient.post(url, data, config);
      } as any;
      
      axios.request = function(config: any) {
        return httpClient.request(config);
      } as any;
      
      console.log('[Mockifyer] Global axios methods patched');
    }
  }
  
  // If httpClientType is 'fetch', always store original fetch (even if not patching global)
  // This prevents issues when multiple instances exist or when global fetch is patched elsewhere
  if (config.httpClientType === 'fetch') {
    // Store original fetch BEFORE any patching happens
    // CRITICAL: Always get the TRUE original fetch, not a patched one
    // If another instance already stored it globally, use that. Otherwise, use current global.fetch
    let originalFetch: typeof fetch;
    if ((global as any).__mockifyer_original_fetch) {
      // Another instance already stored the original - use it
      originalFetch = (global as any).__mockifyer_original_fetch;
      console.log('[Mockifyer] ✅ Using original fetch from global store (already set by another instance)');
    } else {
      // This is the first instance - store the current global.fetch as original
      originalFetch = global.fetch;
      (global as any).__mockifyer_original_fetch = originalFetch;
      console.log('[Mockifyer] ✅ Stored original fetch globally (first instance)');
    }
    
    // Store original fetch in FetchHTTPClient so performRequest can use it
    // This prevents infinite recursion when performRequest calls fetch()
    const fetchClient = httpClient as any;
    if (fetchClient && typeof fetchClient.performRequest === 'function') {
      fetchClient._originalFetch = originalFetch;
      console.log('[Mockifyer] ✅ Set _originalFetch on FetchHTTPClient:', {
        hasOriginalFetch: !!fetchClient._originalFetch,
        originalFetchType: typeof fetchClient._originalFetch,
        useGlobalFetch: config.useGlobalFetch,
        isFunction: typeof fetchClient._originalFetch === 'function'
      });
    } else {
      console.warn('[Mockifyer] ⚠️ Could not set _originalFetch - fetchClient or performRequest not found');
    }
    
    // Only patch global fetch if useGlobalFetch is true
    if (config.useGlobalFetch) {
      // Store reference to mockifyer instance for accessing processingRequests
      const mockifyerInstance = mockifyer;
      const originalFetchForPatched = (global as any).__mockifyer_original_fetch || originalFetch;
      
      // Replace global fetch with a wrapper that uses Mockifyer's HTTPClient
      global.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        // Convert fetch arguments to HTTPClient format
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method || 'GET';
        const headers = init?.headers || {};
        const body = init?.body;
        
        console.log(`[Mockifyer] 🔍 Patched fetch CALLED with URL:`, url.replace(/([?&]key=)[^&]*/, '$1***'));
        console.log(`[Mockifyer] 🔍 Patched fetch URL has search params:`, url.includes('?'));
        
        // CRITICAL: Check if this request is already being processed to prevent infinite loops
        // Generate a simple request key from URL and method (matching the format used in interceptor)
        const simpleRequestKey = `${method}:${url}`;
        const isProcessing = (mockifyerInstance as any).processingRequests?.has(simpleRequestKey);
        if (isProcessing) {
          console.log(`[Mockifyer] 🔄 Patched fetch: Request ${simpleRequestKey} already processing, using _originalFetch directly to prevent loop`);
          // Use original fetch directly to bypass interceptors and prevent loop
          const response = await originalFetchForPatched(input, init);
          return response;
        }
        
        // CRITICAL: Extract query parameters from URL if they exist
        // This is important because performRequest() adds params to the URL, and when it calls
        // the patched fetch(), we need to extract those params back out so they're preserved
        let params: Record<string, string> | undefined = undefined;
        let baseUrl = url;
        try {
          const urlObj = new URL(url);
          if (urlObj.search) {
            params = {};
            urlObj.searchParams.forEach((value, key) => {
              params![key] = value;
            });
            // Remove params from URL since we'll pass them separately
            urlObj.search = '';
            baseUrl = urlObj.toString();
            console.log(`[Mockifyer] 🔍 Patched fetch: Extracted params from URL:`, params);
            console.log(`[Mockifyer] 🔍 Patched fetch: Base URL without params:`, baseUrl);
          } else {
            console.log(`[Mockifyer] ⚠️ Patched fetch: URL has NO search params to extract!`);
          }
        } catch (error) {
          // URL parsing failed, use URL as-is
          console.warn(`[Mockifyer] ⚠️ Could not parse URL to extract params:`, error);
        }
        
        // Convert Headers object to plain object if needed
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
          // Use Mockifyer's HTTPClient - this will go through interceptors and record if in record mode
          // CRITICAL: Pass params separately so they're preserved through the interceptor chain
          const requestConfig = {
            url: baseUrl, // Use base URL without query params since we pass params separately
            method: method as any,
            headers: headersObj,
            params: params, // Pass params separately so they're preserved
            data: body ? (typeof body === 'string' ? (body.startsWith('{') || body.startsWith('[') ? JSON.parse(body) : body) : body) : undefined
          };
          
          console.log(`[Mockifyer] 🔍 Patched fetch: Request config:`, {
            url: requestConfig.url,
            method: requestConfig.method,
            hasParams: !!requestConfig.params,
            params: requestConfig.params,
            paramsCount: params ? Object.keys(params).length : 0
          });
          
          const response = await httpClient.request(requestConfig);
          
          // Convert HTTPResponse to fetch Response
          const responseHeaders = new Headers();
          Object.entries(response.headers || {}).forEach(([key, value]) => {
            responseHeaders.set(key, String(value));
          });
          
          // Handle response data - if it's already a string, use it directly, otherwise stringify
          const responseBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
          
          return new Response(responseBody, {
            status: response.status,
            statusText: response.statusText || '',
            headers: responseHeaders
          });
        } catch (error: any) {
          // Handle errors
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
    } else {
      console.log('[Mockifyer] Fetch client created with original fetch stored (global fetch not patched)');
    }
  }
  
  // Extend the HTTPClient with cache management methods
  // Use direct property assignment to preserve prototype chain and method binding
  const extendedClient = httpClient as MockifyerInstance;
  extendedClient.reloadMockData = () => mockifyer.reloadMockData();
  extendedClient.clearStaleCacheEntries = () => mockifyer.clearStaleCacheEntries();
  
  console.log('[Mockifyer] setupMockifyer returning HTTP client:', {
    hasGet: typeof extendedClient.get === 'function',
    hasRequest: typeof extendedClient.request === 'function',
    hasInterceptors: typeof extendedClient.interceptors === 'object',
    prototype: Object.getPrototypeOf(extendedClient).constructor.name,
    constructor: extendedClient.constructor.name
  });
  
  return extendedClient;
}

// Re-export date utilities and types
export * from './utils/date';
export * from './types';
export * from './clients/http-client-factory';
export * from './types/http-client';

// Re-export axios types for convenience (but users should import axios directly)
export type { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosHeaders } from 'axios'; 