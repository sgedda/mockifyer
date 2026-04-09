// Use require to get the user's axios instance (from peerDependency)
// This ensures we use the same axios instance the user imports
const axios = require('axios');
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
// AxiosHeaders is used as a value (new AxiosHeaders()), so import it normally
import { AxiosHeaders } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import path from 'path';
import { MockifyerConfig, MockData, StoredRequest, StoredResponse, initializeDateManipulation, getCurrentScenario, getScenarioFolderPath, ensureScenarioFolder, initializeScenario, TestGenerator, TestGenerationOptions, checkRequestLimit, prepareMockResponseBody, getCurrentDate } from '@sgedda/mockifyer-core';
import { AxiosHTTPClient } from './clients/axios-client';
import { HTTPClient, HTTPResponse } from '@sgedda/mockifyer-core';
import { 
  generateRequestKey as generateRequestKeyUtil,
  CachedMockData 
} from '@sgedda/mockifyer-core';

class MockifyerClass {
  private config: MockifyerConfig;
  private mockAdapter?: MockAdapter;
  private httpClient: HTTPClient;
  private processingRequests: Set<string> = new Set();
  private savingResponses: Set<string> = new Set();
  private currentSessionId: string | null = null;
  private sessionStartTime: number = 0;
  private readonly SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private testGenerator?: TestGenerator;

  constructor(config: MockifyerConfig) {
    // Validate database provider - only filesystem is currently supported
    if (config.databaseProvider && config.databaseProvider.type && config.databaseProvider.type !== 'filesystem') {
      throw new Error(
        `Database provider type '${config.databaseProvider.type}' is not yet available for use. ` +
        `Only 'filesystem' provider is currently supported. ` +
        `Database providers (SQLite, Memory, Expo) are planned for future releases. ` +
        `Please remove the databaseProvider configuration or set type to 'filesystem' (or undefined).`
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
    
    // Validate conflicting similar match settings
    if (config.similarMatchIgnoreAllQueryParams && 
        config.similarMatchRequiredParams && 
        config.similarMatchRequiredParams.length > 0) {
      console.warn(
        '[Mockifyer] Warning: Both similarMatchIgnoreAllQueryParams and similarMatchRequiredParams are set. ' +
        'similarMatchIgnoreAllQueryParams takes precedence and all query parameters will be ignored. ' +
        'similarMatchRequiredParams will be ignored.'
      );
      // Clear similarMatchRequiredParams to avoid confusion
      config.similarMatchRequiredParams = undefined;
    }
    
    // Auto-enable useSimilarMatch if similarMatchRequiredParams is set (and not ignored)
    if (config.similarMatchRequiredParams && config.similarMatchRequiredParams.length > 0) {
      if (config.useSimilarMatch === undefined || config.useSimilarMatch === false) {
        console.log('[Mockifyer] Auto-enabling useSimilarMatch because similarMatchRequiredParams is set');
        config.useSimilarMatch = true;
      }
    }
    
    // Auto-enable useSimilarMatch if similarMatchIgnoreAllQueryParams is set
    if (config.similarMatchIgnoreAllQueryParams) {
      if (config.useSimilarMatch === undefined || config.useSimilarMatch === false) {
        console.log('[Mockifyer] Auto-enabling useSimilarMatch because similarMatchIgnoreAllQueryParams is set');
        config.useSimilarMatch = true;
      }
    }
    
    this.config = config;
    
    // Initialize test generator if test generation is enabled
    if (config.generateTests?.enabled) {
      this.testGenerator = new TestGenerator();
    }
    
    this.ensureMockDataDirectory();
    
    // Create HTTP client based on configuration
    this.httpClient = new AxiosHTTPClient(config.axiosInstance);
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
    // Ensure scenario folder exists
    const currentScenario = getCurrentScenario(this.config.mockDataPath);
    ensureScenarioFolder(this.config.mockDataPath, currentScenario);
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

    const currentScenario = getCurrentScenario(this.config.mockDataPath);
    const scenarioPath = getScenarioFolderPath(this.config.mockDataPath, currentScenario);
    
    if (!fs.existsSync(scenarioPath)) {
      console.log(`[Mockifyer] Scenario folder does not exist: ${scenarioPath}`);
      return undefined;
    }

    const files = fs.readdirSync(scenarioPath)
      .filter(file => file.endsWith('.json'));

    const requestKey = this.generateRequestKey(request);
    let exactMatch: CachedMockData | undefined;
    let similarMatch: CachedMockData | undefined;
    
    // Read files one by one and check for matches (no cache structure)
    for (const file of files) {
      try {
        const filePath = path.join(scenarioPath, file);
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
          // Normalize empty queryParams from mock files: treat {} the same as undefined
          const qp = mockData.request.queryParams;
          const normalizedQueryParams = qp && Object.keys(qp).length > 0 ? qp : undefined;
          
          // Normalize URL: remove trailing ? if params are empty (axios might add it)
          let normalizedMockUrl = mockData.request.url || '';
          if (normalizedMockUrl.endsWith('?') && !normalizedQueryParams) {
            normalizedMockUrl = normalizedMockUrl.slice(0, -1);
          }
          
          const normalizedMockRequest: StoredRequest = {
            ...mockData.request,
            url: normalizedMockUrl,
            queryParams: normalizedQueryParams
          };
          mockKey = this.generateRequestKey(normalizedMockRequest);
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
                
                // If ignoreAllQueryParams is set, skip query param checking entirely
                if (this.config.similarMatchIgnoreAllQueryParams) {
                  console.log('[Mockifyer] ✅ Ignoring all query params, using similar match (path and method only)');
                } else if (this.config.similarMatchRequiredParams && this.config.similarMatchRequiredParams.length > 0) {
                  // Check if required parameters match (if configured)
                  const requestParams = request.queryParams || {};
                  const mockParams = mockData.request.queryParams || {};
                  
                  console.log('[Mockifyer] Checking similarMatchRequiredParams:', {
                    requiredParams: this.config.similarMatchRequiredParams,
                    requestParams,
                    mockParams,
                    requestUrl: request.url,
                    mockUrl: mockData.request.url
                  });
                  
                  const allRequiredMatch = this.config.similarMatchRequiredParams.every(paramName => {
                    const requestValue = requestParams[paramName];
                    const mockValue = mockParams[paramName];
                    const matches = requestValue === undefined && mockValue === undefined 
                      ? true 
                      : String(requestValue || '') === String(mockValue || '');
                    
                    console.log(`[Mockifyer] Param "${paramName}": request="${requestValue}" vs mock="${mockValue}" => ${matches ? 'MATCH' : 'NO MATCH'}`);
                    
                    return matches;
                  });
                  
                  if (!allRequiredMatch) {
                    console.log('[Mockifyer] ❌ Similar match rejected: required params do not match');
                    continue; // Required parameter differs, skip this mock
                  }
                  
                  console.log('[Mockifyer] ✅ All required params match, using similar match');
                } else {
                  // No query param restrictions - match on path and method only (default behavior)
                  console.log('[Mockifyer] ✅ No query param restrictions (default), using similar match (path and method only, all query params ignored)');
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
      const currentScenario = getCurrentScenario(this.config.mockDataPath);
      const scenarioPath = getScenarioFolderPath(this.config.mockDataPath, currentScenario);
      if (fs.existsSync(scenarioPath)) {
        const files = fs.readdirSync(scenarioPath)
          .filter(file => file.endsWith('.json'));
        console.log(`[Mockifyer] Found ${files.length} mock files in scenario "${currentScenario}" (will read on demand)`);
      } else {
        console.log(`[Mockifyer] Scenario folder does not exist: ${scenarioPath}`);
      }
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
      // Normalize empty params: treat {} the same as undefined
      const rawParams = config.params || {};
      const anonymizedQueryParams = this.anonymizeQueryParams(rawParams);
      // Normalize empty params object to undefined for consistent matching
      const normalizedParams = anonymizedQueryParams && Object.keys(anonymizedQueryParams).length > 0 
        ? anonymizedQueryParams 
        : undefined;
      
      // Normalize URL: remove trailing ? if params are empty (axios might add it)
      let normalizedUrl = config.url || '';
      if (normalizedUrl.endsWith('?') && !normalizedParams) {
        normalizedUrl = normalizedUrl.slice(0, -1);
      }
      
      const request: StoredRequest = {
        method: config.method || 'GET',
        url: normalizedUrl,
        headers: config.headers || {},
        data: config.data,
        queryParams: normalizedParams
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

      if (this.config.failOnMissingMock) {
        throw new Error(`No mock data found for request: ${this.generateRequestKey(request)}`);
      }

      return config;
    });
  }

  private setupInterceptors(): void {
    // Always set up request interceptor to check limits
    // In record mode, only check for mocks if recordSameEndpoints is false
    // This allows re-recording when recordSameEndpoints is true
    // When recordSameEndpoints is false, use existing mocks to avoid unnecessary API calls
    this.httpClient.interceptors.request.use(async (config) => {
      // In record mode, only check for mocks if recordSameEndpoints is false
      if (this.config.recordSameEndpoints !== true) {
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
        const rawParams = config.params || {};
        const anonymizedQueryParams = this.anonymizeQueryParams(rawParams);
        // Normalize empty params object to undefined for consistent matching
        const normalizedParams = anonymizedQueryParams && Object.keys(anonymizedQueryParams).length > 0 
          ? anonymizedQueryParams 
          : undefined;
        
        // Normalize URL: remove trailing ? if params are empty (axios might add it)
        let normalizedUrl = config.url || '';
        if (normalizedUrl.endsWith('?') && !normalizedParams) {
          normalizedUrl = normalizedUrl.slice(0, -1);
        }
        
        const request: StoredRequest = {
          method: config.method || 'GET',
          url: normalizedUrl,
          headers: config.headers || {}, // Headers are not part of the key, but included for reference
          data: config.data, // This should include the GraphQL query and variables
          queryParams: normalizedParams
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
        
        // CRITICAL: Check for mocks FIRST, even if request is already processing
        // This ensures that when multiple requests to the same endpoint run sequentially,
        // they all use the mock instead of making real API calls
        let cachedMock: CachedMockData | undefined;
        try {
          cachedMock = await this.findBestMatchingMock(request);
          console.log(`[Mockifyer] 🔍 Mock lookup result for ${requestKey}:`, {
            found: !!cachedMock,
            filename: cachedMock?.filename,
            url: request.url,
            method: request.method,
            isAlreadyProcessing: this.processingRequests.has(requestKey)
          });
        } catch (error) {
          console.error(`[Mockifyer] ❌ Error during mock lookup:`, error);
        }
        
        // If mock found, use it regardless of processingRequests status
        if (cachedMock) {
          console.log(`[Mockifyer] ✅ Found mock for ${requestKey}, using it (even if already processing)`);
          const { mockData, filename, filePath } = cachedMock;
          // Use existing mock instead of making real API call
          // This is correct behavior - we have a mock, so use it
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
          
          // Axios client - use adapter
          const mockResponse: AxiosResponse = {
            data: prepareMockResponseBody(mockData, getCurrentDate),
            status: mockData.response.status,
            statusText: 'OK',
            headers: axiosHeaders,
            config: config as any,
            request: {}
          };
          
          const adapterConfig = {
            ...config,
            adapter: () => {
              console.log(`[Mockifyer] 📦 Adapter called, returning mock response for ${requestKey}`);
              console.log(`[Mockifyer] 📦 Mock response headers:`, mockResponse.headers);
              console.log(`[Mockifyer] 📦 Mock response headers type:`, typeof mockResponse.headers);
              if (typeof (mockResponse.headers as any).get === 'function') {
                console.log(`[Mockifyer] 📦 x-mockifyer header value:`, (mockResponse.headers as any).get('x-mockifyer'));
              } else {
                console.log(`[Mockifyer] 📦 x-mockifyer header value:`, (mockResponse.headers as any)['x-mockifyer']);
              }
              
              // CRITICAL: Mark this as a mock response so response interceptor can detect it
              (mockResponse.config as any).__mockifyer_isMock = true;
              
              // CRITICAL: Store headers in config to preserve them if axios strips them from response
              // Extract headers as plain object to avoid AxiosHeaders serialization issues
              let preservedHeaders: Record<string, string> = {};
              if (mockResponse.headers) {
                if (typeof (mockResponse.headers as any).toJSON === 'function') {
                  preservedHeaders = (mockResponse.headers as any).toJSON();
                } else if (typeof (mockResponse.headers as any).forEach === 'function') {
                  (mockResponse.headers as any).forEach((value: string, key: string) => {
                    if (value !== undefined && value !== null) {
                      preservedHeaders[key.toLowerCase()] = String(value);
                    }
                  });
                } else if (typeof mockResponse.headers === 'object') {
                  Object.entries(mockResponse.headers).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                      preservedHeaders[key.toLowerCase()] = String(value);
                    }
                  });
                }
              }
              (mockResponse.config as any).__mockifyer_headers = preservedHeaders;
              
              return Promise.resolve(mockResponse);
            }
          } as any;
          
          console.log(`[Mockifyer] ✅ Returning config with adapter for mock response. Has adapter: ${!!adapterConfig.adapter}`);
          return adapterConfig;
        }
        
        // No mock found - check if already processing to prevent infinite loops
        if (this.processingRequests.has(requestKey)) {
          console.log(`[Mockifyer] ⚠️ Already processing ${requestKey} and no mock found, skipping to prevent infinite loop`);
          // CRITICAL: Preserve all config properties including params when returning early
          const returnConfig = { ...config };
          // Explicitly preserve params - they might be lost in the spread
          if (config.params) {
            returnConfig.params = config.params;
            console.log(`[Mockifyer] Preserved params in early return:`, returnConfig.params);
          }
          return returnConfig;
        }
        
        // Check request limit BEFORE making real API call (only if no mock found and in record mode)
        if (this.config.recordMode) {
          const limitCheck = checkRequestLimit(this.config.mockDataPath);
          if (limitCheck.limitReached && limitCheck.error) {
            console.warn(`[Mockifyer] ⚠️ ${limitCheck.error.message}`);
            
            // Return a mock error response instead of making a real API call
            const responseHeaders = {
              'x-mockifyer': 'true',
              'x-mockifyer-limit-reached': 'true',
              'content-type': 'application/json'
            };

            const axiosHeaders = new AxiosHeaders();
            Object.entries(responseHeaders).forEach(([key, value]) => {
              axiosHeaders.set(key, value);
            });

            const mockErrorResponse: AxiosResponse = {
              data: {
                error: limitCheck.error.message,
                message: limitCheck.error.message,
                limitReached: true,
                maxRequests: limitCheck.error.maxRequests,
                currentScenario: limitCheck.error.currentScenario
              },
              status: 429, // Too Many Requests
              statusText: 'Too Many Requests',
              headers: axiosHeaders,
              config: config as any,
              request: {}
            };
            
            const adapterConfig = {
              ...config,
              adapter: () => {
                console.log(`[Mockifyer] 📦 Returning limit error response for ${requestKey}`);
                // Mark as mock response
                (mockErrorResponse.config as any).__mockifyer_isMock = true;
                return Promise.resolve(mockErrorResponse);
              }
            } as any;
            
            return adapterConfig;
          }
        }
        
        console.log(`[Mockifyer] 🔍 Processing request: ${requestKey}`);
        if (request.method === 'POST' && request.data) {
          console.log(`[Mockifyer] 📦 Request data type: ${typeof request.data}, isString: ${typeof request.data === 'string'}`);
        }
        this.processingRequests.add(requestKey);
        
        try {
          // No mock found - will make real API call (this is correct)
          console.log(`[Mockifyer] ❌ No mock found for ${requestKey}, will make real API call`);
          console.log(`[Mockifyer] Returning config with params:`, {
            url: config.url,
            method: config.method,
            hasParams: !!config.params,
            params: config.params,
            // httpClientType removed - axios only
            allKeys: Object.keys(config)
          });
          // CRITICAL: Don't delete from processingRequests here - wait until after performRequest completes
          // We'll delete it in the response interceptor after the request completes
          
          // CRITICAL: Always preserve params - they're needed for performRequest to add them to the URL
          const returnConfig = { ...config };
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
        // End of recordSameEndpoints !== true block
      } else {
        // recordSameEndpoints is true - always make real API calls, don't check for mocks
        // But we still need to check the limit before making real API calls!
        if (this.config.recordMode) {
          const limitCheck = checkRequestLimit(this.config.mockDataPath);
          if (limitCheck.limitReached && limitCheck.error) {
            console.warn(`[Mockifyer] ⚠️ ${limitCheck.error.message}`);
            
            // Generate request key for consistency
            const rawParams = config.params || {};
            const anonymizedQueryParams = this.anonymizeQueryParams(rawParams);
            const normalizedParams = anonymizedQueryParams && Object.keys(anonymizedQueryParams).length > 0 
              ? anonymizedQueryParams 
              : undefined;
            
            let normalizedUrl = config.url || '';
            if (normalizedUrl.endsWith('?') && !normalizedParams) {
              normalizedUrl = normalizedUrl.slice(0, -1);
            }
            
            const request: StoredRequest = {
              method: config.method || 'GET',
              url: normalizedUrl,
              headers: config.headers || {},
              data: config.data,
              queryParams: normalizedParams
            };
            const requestKey = this.generateRequestKey(request);
            
            // Return a mock error response instead of making a real API call
            const responseHeaders = {
              'x-mockifyer': 'true',
              'x-mockifyer-limit-reached': 'true',
              'content-type': 'application/json'
            };

            const axiosHeaders = new AxiosHeaders();
            Object.entries(responseHeaders).forEach(([key, value]) => {
              axiosHeaders.set(key, value);
            });

            const mockErrorResponse: AxiosResponse = {
              data: {
                error: limitCheck.error.message,
                message: limitCheck.error.message,
                limitReached: true,
                maxRequests: limitCheck.error.maxRequests,
                currentScenario: limitCheck.error.currentScenario
              },
              status: 429, // Too Many Requests
              statusText: 'Too Many Requests',
              headers: axiosHeaders,
              config: config as any,
              request: {}
            };
            
            const adapterConfig = {
              ...config,
              adapter: () => {
                console.log(`[Mockifyer] 📦 Returning limit error response (recordSameEndpoints=true) for ${requestKey}`);
                // Mark as mock response
                (mockErrorResponse.config as any).__mockifyer_isMock = true;
                return Promise.resolve(mockErrorResponse);
              }
            } as any;
            
            return adapterConfig;
          }
        }
        // If recordSameEndpoints is true, just return config to proceed with real API call
        return config;
      }
    });

    // Add response interceptor to record responses (only for real API calls)
    // Skip recording if this is a mocked response (has x-mockifyer header)
    // CRITICAL: When useGlobalAxios is true, interceptors are added to global axios instead
    // So we only register on httpClient when useGlobalAxios is false
    if (!this.config.useGlobalAxios) {
      this.httpClient.interceptors.response.use(
      (response) => {
        console.log('[Mockifyer] 🎯 Response interceptor called!', {
          url: response.config?.url,
          status: response.status,
          hasConfig: !!response.config,
          headersType: typeof response.headers,
          hasHeaders: !!response.headers
        });
        
        // CRITICAL: Clean up processingRequests after request completes
        // This prevents infinite loops when useGlobalFetch: true
        const requestKey = (response.config as any).__mockifyer_requestKey;
        if (requestKey) {
          this.processingRequests.delete(requestKey);
          console.log(`[Mockifyer] ✅ Removed ${requestKey} from processingRequests after request completed`);
        }
        
        // Check if this is a mocked response - if so, don't record it
        // First check the flag set by the adapter
        let isMocked = !!(response.config as any).__mockifyer_isMock;
        console.log(`[Mockifyer] 🔍 Checking if response is mocked (local axios):`, {
          hasConfig: !!response.config,
          hasMockFlag: !!(response.config as any).__mockifyer_isMock,
          hasHeaders: !!response.headers,
          headersType: typeof response.headers,
          hasGetMethod: typeof (response.headers as any)?.get === 'function'
        });
        
        // If not already marked as mock, check headers
        if (!isMocked && response.headers) {
          console.log(`[Mockifyer] 🔍 Checking headers for x-mockifyer. Headers type: ${typeof response.headers}, isFunction: ${typeof (response.headers as any).get === 'function'}`);
          
          if (typeof (response.headers as any).get === 'function') {
            // AxiosHeaders instance - use get method (case-insensitive)
            const headerValue = (response.headers as any).get('x-mockifyer');
            isMocked = headerValue === 'true';
            console.log(`[Mockifyer] 🔍 AxiosHeaders.get('x-mockifyer'): ${headerValue}, isMocked: ${isMocked}`);
          } else if (typeof (response.headers as any).forEach === 'function') {
            // AxiosHeaders instance but without get method - use forEach
            (response.headers as any).forEach((value: string, key: string) => {
              if (key.toLowerCase() === 'x-mockifyer') {
                console.log(`[Mockifyer] 🔍 Found x-mockifyer via forEach: ${value}`);
                isMocked = value === 'true';
              }
            });
          } else if (typeof response.headers === 'object' && !Array.isArray(response.headers)) {
            // Plain object - check case-insensitively (axios normalizes headers to lowercase)
            const headers = response.headers as any;
            const headerKeys = Object.keys(headers);
            console.log(`[Mockifyer] 🔍 Plain object headers. Keys:`, headerKeys.slice(0, 15));
            const mockifyerKey = headerKeys.find(key => key.toLowerCase() === 'x-mockifyer');
            if (mockifyerKey) {
              isMocked = headers[mockifyerKey] === 'true';
              console.log(`[Mockifyer] 🔍 Found x-mockifyer header with key "${mockifyerKey}": ${headers[mockifyerKey]}, isMocked: ${isMocked}`);
            } else {
              console.log(`[Mockifyer] 🔍 No x-mockifyer header found in headers. Available keys:`, headerKeys.slice(0, 10));
            }
          }
        } else if (!isMocked) {
          console.log(`[Mockifyer] 🔍 No headers object found in response`);
        }
        
        console.log(`[Mockifyer] 🔍 Final isMocked check result (local axios): ${isMocked}`);
        
        // Also check for limit reached header
        let isLimitReached = false;
        if (response.headers) {
          if (typeof (response.headers as any).get === 'function') {
            isLimitReached = (response.headers as any).get('x-mockifyer-limit-reached') === 'true';
          } else if (typeof response.headers === 'object' && !Array.isArray(response.headers)) {
            const headers = response.headers as any;
            const limitKey = Object.keys(headers).find(key => key.toLowerCase() === 'x-mockifyer-limit-reached');
            if (limitKey && headers[limitKey] === 'true') {
              isLimitReached = true;
            }
          }
        }
        
        if (isMocked || isLimitReached) {
          console.log('[Mockifyer] ✅ Skipping recording - this is a mocked response' + (isLimitReached ? ' (limit reached)' : ''));
          return response;
        } else {
          console.log('[Mockifyer] ⚠️ Response is NOT mocked, will record it');
        }
        
        // Use the request key from the request interceptor if available
        // This ensures we use the same key that was used for matching
        let requestKeyForRecording = (response.config as any).__mockifyer_requestKey;
        
        // Fallback: generate key if not stored (shouldn't happen, but safety check)
        if (!requestKeyForRecording) {
          // Normalize empty params: treat {} the same as undefined for consistent matching
          const rawParams = response.config.params || {};
          const normalizedParams = rawParams && Object.keys(rawParams).length > 0 ? rawParams : undefined;
          
          // Normalize URL: remove trailing ? if params are empty (axios might add it)
          let normalizedUrl = response.config.url || '';
          if (normalizedUrl.endsWith('?') && !normalizedParams) {
            normalizedUrl = normalizedUrl.slice(0, -1);
          }
          
          requestKeyForRecording = this.generateRequestKey({
            method: response.config.method?.toUpperCase() || 'GET',
            url: normalizedUrl,
            headers: {},
            data: response.config.data, // CRITICAL: Include data for POST requests (GraphQL)
            queryParams: normalizedParams
          });
        }
        
        console.log(`[Mockifyer] 📹 Recording response for: ${requestKeyForRecording}`);
        
        // Store the request key on the response config so saveResponse can use it
        (response.config as any).__mockifyer_requestKey = requestKeyForRecording;
        
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
          // Headers can be AxiosHeaders instance or plain object, and keys might be lowercase
          let isMocked = false;
          if (error.response.headers) {
            if (typeof (error.response.headers as any).get === 'function') {
              // AxiosHeaders instance - use get method (case-insensitive)
              isMocked = (error.response.headers as any).get('x-mockifyer') === 'true';
            } else if (typeof error.response.headers === 'object' && !Array.isArray(error.response.headers)) {
              // Plain object - check case-insensitively (axios normalizes headers to lowercase)
              const headers = error.response.headers as any;
              isMocked = Object.keys(headers).some(key => 
                key.toLowerCase() === 'x-mockifyer' && headers[key] === 'true'
              );
            }
          }
          
          if (isMocked) {
            console.log('[Mockifyer] Skipping recording - this is a mocked error response');
            return Promise.reject(error);
          }
          
          // Use the request key from the request interceptor if available
          const errorRequestKey = (error.config as any)?.__mockifyer_requestKey;
          if (errorRequestKey && error.response?.config) {
            (error.response.config as any).__mockifyer_requestKey = errorRequestKey;
          }
          
          console.log('[Mockifyer] Recording error response for:', {
            method: error.response.config.method?.toUpperCase() || 'GET',
            url: error.response.config.url,
            status: error.response.status,
            requestKey: errorRequestKey || 'not found'
          });
          this.saveResponse(error.response as HTTPResponse);
        }
        return Promise.reject(error);
      }
    );
    } else {
      console.log('[Mockifyer] ⚠️ useGlobalAxios is true, response interceptor will be added to global axios instead');
    }
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
    // CRITICAL: Skip saving responses from Resend API
    const url = response.config?.url || '';
    if (url && url.includes('api.resend.com')) {
      console.log('[Mockifyer] ⚠️ Skipping save - Resend API request:', url);
      return;
    }
    
    // CRITICAL SAFETY CHECK: Don't save mocked responses
    // This is a final safeguard in case the interceptor check is bypassed
    let isMocked = false;
    if (response.headers) {
      if (typeof (response.headers as any).get === 'function') {
        isMocked = (response.headers as any).get('x-mockifyer') === 'true';
      } else if (typeof response.headers === 'object' && !Array.isArray(response.headers)) {
        const headers = response.headers as any;
        const mockifyerKey = Object.keys(headers).find(key => key.toLowerCase() === 'x-mockifyer');
        if (mockifyerKey && headers[mockifyerKey] === 'true') {
          isMocked = true;
        }
      }
    }
    
    if (isMocked) {
      console.log('[Mockifyer] 🛡️ saveResponse: Blocked saving mocked response (safety check)');
      return;
    }
    
    // Use the request key from the request interceptor if available
    // This ensures we use the same key that was used for matching
    let requestKey = (response.config as any).__mockifyer_requestKey;
    
    // Fallback: generate key if not stored (shouldn't happen, but safety check)
    if (!requestKey) {
      console.warn(`[Mockifyer] ⚠️ requestKey not found in config, generating fallback key. This should not happen!`);
      
      // CRITICAL: Use the same normalization logic as the request interceptor
      // Anonymize query params before matching (same as when saving)
      const rawParams = response.config.params || {};
      const anonymizedQueryParams = this.anonymizeQueryParams(rawParams);
      // Normalize empty params object to undefined for consistent matching
      const normalizedParams = anonymizedQueryParams && Object.keys(anonymizedQueryParams).length > 0 
        ? anonymizedQueryParams 
        : undefined;
      
      // Normalize URL: remove trailing ? if params are empty (axios might add it)
      let normalizedUrl = response.config.url || '';
      if (normalizedUrl.endsWith('?') && !normalizedParams) {
        normalizedUrl = normalizedUrl.slice(0, -1);
      }
      
      const tempRequest: StoredRequest = {
        method: response.config.method?.toUpperCase() || 'GET',
        url: normalizedUrl,
        headers: {}, // Headers are not part of the key
        data: response.config.data, // CRITICAL: Include data for POST requests (GraphQL)
        queryParams: normalizedParams
      };
      requestKey = this.generateRequestKey(tempRequest);
      console.log(`[Mockifyer] Generated fallback requestKey: ${requestKey.substring(0, 200)}`);
    }
    
    // Prevent duplicate saves
    // CRITICAL: Check if we're already saving this exact request key
    if (this.savingResponses.has(requestKey)) {
      console.log(`[Mockifyer] ⚠️ Already saving response for ${requestKey}, skipping duplicate save`);
      return;
    }
    
    // CRITICAL: Also check if a file with this request key already exists
    // This prevents creating duplicate files even if the Set check fails (e.g., after restart)
    // BUT: In record mode, if a mock exists, we should NOT have made a real API call in the first place!
    // This check is a safety net, but the real fix is ensuring the request interceptor finds mocks
    const existingMock = await this.findBestMatchingMock({
      method: response.config.method?.toUpperCase() || 'GET',
      url: response.config.url || '',
      headers: {},
      data: response.config.data,
      queryParams: response.config.params && Object.keys(response.config.params).length > 0 
        ? response.config.params 
        : undefined
    });
    
    if (existingMock) {
      console.log(`[Mockifyer] ⚠️ Mock file already exists for ${requestKey}, skipping save to prevent duplicates`);
      console.log(`[Mockifyer] ⚠️ WARNING: This should not happen in record mode - request interceptor should have found the mock!`);
      console.log(`[Mockifyer] ⚠️ This suggests the request interceptor didn't find the mock, causing an unnecessary API call.`);
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
      // Normalize empty params: treat {} the same as undefined for consistent matching
      const rawParams = response.config.params || {};
      const anonymizedQueryParams = this.anonymizeQueryParams(rawParams);
      const normalizedParams = anonymizedQueryParams && Object.keys(anonymizedQueryParams).length > 0 
        ? anonymizedQueryParams 
        : undefined;
      
      // Normalize URL: remove trailing ? if params are empty (axios might add it)
      let normalizedUrl = response.config.url || '';
      if (normalizedUrl.endsWith('?') && !normalizedParams) {
        normalizedUrl = normalizedUrl.slice(0, -1);
      }
      
      const request: StoredRequest = {
        method: response.config.method?.toUpperCase() || 'GET',
        url: normalizedUrl,
        headers: anonymizedHeaders,
        data: response.config.data,
        queryParams: normalizedParams
      };

      // Always check cache first, unless recordSameEndpoints is true


      const storedResponse: StoredResponse = {
        status: response.status,
        data: response.data,
        headers: response.headers as Record<string, string>
      };

      // Generate or reuse sessionId
      const nowTimestamp = Date.now();
      if (!this.currentSessionId || (nowTimestamp - this.sessionStartTime) > this.SESSION_TIMEOUT_MS) {
        // Generate new session ID
        this.currentSessionId = `session-${nowTimestamp}-${Math.random().toString(36).substring(2, 11)}`;
        this.sessionStartTime = nowTimestamp;
      }

      // Calculate request duration if start time is available
      const startTime = (response.config as any).__mockifyer_startTime;
      const duration = startTime ? Date.now() - startTime : undefined;

      const mockData: MockData = {
        request,
        response: storedResponse,
        timestamp: new Date().toISOString(),
        duration,
        scenario: this.config.scenarios?.default,
        sessionId: this.currentSessionId
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
      const currentScenario = getCurrentScenario(this.config.mockDataPath);
      const scenarioPath = getScenarioFolderPath(this.config.mockDataPath, currentScenario);
      ensureScenarioFolder(this.config.mockDataPath, currentScenario);
      
      // Check request limit before saving (only if limit is set via env var)
      const limitCheck = checkRequestLimit(this.config.mockDataPath);
      if (limitCheck.limitReached && limitCheck.error) {
        console.warn(`[Mockifyer] ⚠️ ${limitCheck.error.message}`);
        // Don't throw - just log and return to prevent app crash
        return;
      }
      
      const filePath = path.join(scenarioPath, filename);
      
      // Write to file (no cache)
      fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
      console.log(`[Mockifyer] Saved new mock to file: ${currentScenario}/${filename}`);
      
      // Generate test if enabled
      if (this.config.generateTests?.enabled && this.testGenerator) {
        await this.generateTestForMock(mockData);
      }
    } finally {
      // Remove from saving set after save completes
      this.savingResponses.delete(requestKey);
    }
  }

  /**
   * Generates test file for a mock
   */
  private async generateTestForMock(mockData: MockData): Promise<void> {
    if (!this.testGenerator || !fs || !path) {
      return;
    }

    try {
      const options: TestGenerationOptions = {
        framework: this.config.generateTests?.framework || 'jest',
        outputPath: this.config.generateTests?.outputPath || './tests/generated',
        testPattern: this.config.generateTests?.testPattern || '{endpoint}.test.ts',
        includeSetup: this.config.generateTests?.includeSetup !== false,
        groupBy: this.config.generateTests?.groupBy || 'file',
        httpClientType: 'axios'
      };

      const testCode = this.testGenerator.generateTest(mockData, options);
      const testFilePath = this.testGenerator.determineTestFilePath(mockData, options);
      
      // Ensure test directory exists
      const testDir = path.dirname(testFilePath);
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      // Check if test file already exists
      if (fs.existsSync(testFilePath)) {
        // Extract test info to check if test already exists
        const testInfo = this.testGenerator.analyzeMock(mockData, 'axios');
        const testName = this.generateTestNameFromInfo(testInfo);
        
        // Check if test already exists
        const existingContent = fs.readFileSync(testFilePath, 'utf-8');
        if (existingContent.includes(`it('${testName}'`) || existingContent.includes(`it("${testName}"`)) {
          console.log(`[Mockifyer] Test already exists in ${testFilePath}, skipping generation`);
          return;
        }
        
        // Extract test code without imports and describe wrapper
        const testMatch = testCode.match(/it\('.*?', async \(\) => \{[\s\S]*?\}\);?/);
        if (testMatch) {
          // Append test to existing describe block
          const newTest = testMatch[0];
          const updatedContent = existingContent.replace(
            /(\s+)(\}\);?\s*)$/,
            `$1${newTest}\n$1$2`
          );
          fs.writeFileSync(testFilePath, updatedContent);
          console.log(`[Mockifyer] ✅ Appended test to existing file: ${testFilePath}`);
        }
      } else {
        // Create new test file
        fs.writeFileSync(testFilePath, testCode);
        console.log(`[Mockifyer] ✅ Generated test: ${testFilePath}`);
      }
    } catch (error) {
      console.error('[Mockifyer] ❌ Error generating test:', error);
      // Don't throw - test generation failure shouldn't break mock saving
    }
  }

  /**
   * Helper to generate test name from test info
   */
  private generateTestNameFromInfo(testInfo: any): string {
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
  initializeScenario(config);

  const mockifyer = new MockifyerClass(config);
  const httpClient = mockifyer.getHTTPClient();
  
  // If useGlobalAxios is true, patch the global axios instance
  if (config.useGlobalAxios) {
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
      console.log('[Mockifyer] Checking request interceptors:', {
        hasRequestInterceptors: !!baseClient.requestInterceptors,
        interceptorCount: baseClient.requestInterceptors?.length || 0,
        recordMode: config.recordMode,
        useGlobalAxios: config.useGlobalAxios
      });
      
      if (baseClient.requestInterceptors && baseClient.requestInterceptors.length > 0) {
        console.log('[Mockifyer] ✅ Found', baseClient.requestInterceptors.length, 'request interceptors, adding to global axios');
        baseClient.requestInterceptors.forEach((interceptor: any, index: number) => {
          if (interceptor.onFulfilled) {
            console.log(`[Mockifyer] Adding request interceptor ${index + 1} to global axios`);
            globalAxios.interceptors.request.use(
              async (config: any) => {
                console.log(`[Mockifyer] 🔍 Global axios request interceptor ${index + 1} called for:`, config.url);
                const result = await interceptor.onFulfilled(config);
                console.log(`[Mockifyer] 🔍 Global axios request interceptor ${index + 1} result:`, {
                  url: result.url,
                  hasAdapter: !!(result as any).adapter,
                  hasMockResponse: !!(result as any).__mockResponse
                });
                return result;
              },
              interceptor.onRejected
            );
          }
        });
        console.log('[Mockifyer] ✅ Request interceptors added to global axios');
      } else {
        console.warn('[Mockifyer] ⚠️ No request interceptors found! This might be why mocks are not working for global axios.');
      }
      
      // CRITICAL: Add response interceptor directly to global axios for recording
      // When useGlobalAxios is true, we need to add the response interceptor directly here
      // because it's not added to httpClient (line 668 skips it)
      if (config.recordMode) {
        console.log('[Mockifyer] Adding response interceptor directly to global axios for recording');
        const interceptorId = globalAxios.interceptors.response.use(
          async function(axiosResponse: any) {
            console.log('[Mockifyer] 🎯🎯🎯 Global axios response interceptor called!', {
              url: axiosResponse.config?.url,
              status: axiosResponse.status
            });
            
            try {
              // CRITICAL: Clean up processingRequests after request completes
              const requestKey = (axiosResponse.config as any).__mockifyer_requestKey;
              if (requestKey) {
                mockifyer['processingRequests'].delete(requestKey);
                console.log(`[Mockifyer] ✅ Removed ${requestKey} from processingRequests after request completed`);
              }
              
              // Check if this is a mocked response - if so, don't record it
              // First check the flag set by the adapter
              let isMocked = !!(axiosResponse.config as any).__mockifyer_isMock;
              console.log('[Mockifyer] 🔍 Checking if response is mocked:', {
                hasConfig: !!axiosResponse.config,
                hasMockFlag: !!(axiosResponse.config as any).__mockifyer_isMock,
                hasHeaders: !!axiosResponse.headers,
                headersType: typeof axiosResponse.headers,
                hasGetMethod: typeof axiosResponse.headers?.get === 'function',
                headersKeys: axiosResponse.headers ? (typeof axiosResponse.headers.forEach === 'function' ? 'AxiosHeaders (forEach)' : Object.keys(axiosResponse.headers)) : 'none'
              });
              
              // If not already marked as mock, check headers
              if (!isMocked && axiosResponse.headers) {
                if (typeof axiosResponse.headers.get === 'function') {
                  // AxiosHeaders instance - use get method (case-insensitive)
                  const headerValue = axiosResponse.headers.get('x-mockifyer');
                  console.log('[Mockifyer] 🔍 AxiosHeaders.get("x-mockifyer"):', headerValue);
                  isMocked = headerValue === 'true';
                } else if (typeof axiosResponse.headers.forEach === 'function') {
                  // AxiosHeaders instance but without get method - use forEach
                  axiosResponse.headers.forEach((value: string, key: string) => {
                    if (key.toLowerCase() === 'x-mockifyer') {
                      console.log('[Mockifyer] 🔍 Found x-mockifyer via forEach:', value);
                      isMocked = value === 'true';
                    }
                  });
                } else if (typeof axiosResponse.headers === 'object' && !Array.isArray(axiosResponse.headers)) {
                  // Plain object - check case-insensitively
                  const headers = axiosResponse.headers as any;
                  const mockifyerKey = Object.keys(headers).find(key => key.toLowerCase() === 'x-mockifyer');
                  console.log('[Mockifyer] 🔍 Plain object headers, mockifyerKey:', mockifyerKey, 'value:', mockifyerKey ? headers[mockifyerKey] : 'not found');
                  if (mockifyerKey && headers[mockifyerKey] === 'true') {
                    isMocked = true;
                  }
                }
              }
              
              console.log('[Mockifyer] 🔍 Final isMocked check result:', isMocked);
              
              if (isMocked) {
                console.log('[Mockifyer] ✅ Global axios interceptor: Skipping recording - this is a mocked response');
                return axiosResponse;
              }
              
              console.log('[Mockifyer] ⚠️ Global axios interceptor: Response is NOT mocked, will record it');
              
              // Convert Axios response to HTTPResponse format for saveResponse
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
              
              // Use the request key from the request interceptor if available
              let requestKeyForRecording = (axiosResponse.config as any).__mockifyer_requestKey;
              
              // Fallback: generate key if not stored
              if (!requestKeyForRecording) {
                const rawParams = axiosResponse.config.params || {};
                const anonymizedQueryParams = mockifyer['anonymizeQueryParams'](rawParams);
                const normalizedParams = anonymizedQueryParams && Object.keys(anonymizedQueryParams).length > 0 
                  ? anonymizedQueryParams 
                  : undefined;
                
                let normalizedUrl = axiosResponse.config.url || '';
                if (normalizedUrl.endsWith('?') && !normalizedParams) {
                  normalizedUrl = normalizedUrl.slice(0, -1);
                }
                
                requestKeyForRecording = mockifyer['generateRequestKey']({
                  method: axiosResponse.config.method?.toUpperCase() || 'GET',
                  url: normalizedUrl,
                  headers: {},
                  data: axiosResponse.config.data,
                  queryParams: normalizedParams
                });
              }
              
              console.log(`[Mockifyer] 📹 Recording response for: ${requestKeyForRecording}`);
              
              // Store the request key on the response config so saveResponse can use it
              (httpResponse.config as any).__mockifyer_requestKey = requestKeyForRecording;
              
              // Call saveResponse directly
              await mockifyer['saveResponse'](httpResponse);
              
              return axiosResponse;
            } catch (error) {
              console.error('[Mockifyer] Error in global axios response interceptor:', error);
              throw error;
            }
          },
          async function(error: any) {
            // CRITICAL: Clean up processingRequests after request fails
            if (error.config) {
              const requestKey = (error.config as any).__mockifyer_requestKey;
              if (requestKey) {
                mockifyer['processingRequests'].delete(requestKey);
                console.log(`[Mockifyer] ✅ Removed ${requestKey} from processingRequests after request failed`);
              }
            }
            
            if (error.response) {
              // Check if this is a mocked error response
              let isMocked = false;
              if (error.response.headers) {
                if (typeof error.response.headers.get === 'function') {
                  isMocked = error.response.headers.get('x-mockifyer') === 'true';
                } else if (typeof error.response.headers === 'object' && !Array.isArray(error.response.headers)) {
                  const headers = error.response.headers as any;
                  isMocked = Object.keys(headers).some(key => 
                    key.toLowerCase() === 'x-mockifyer' && headers[key] === 'true'
                  );
                }
              }
              
              if (isMocked) {
                console.log('[Mockifyer] Skipping recording - this is a mocked error response');
                return Promise.reject(error);
              }
              
              // Convert Axios error response to HTTPResponse format
              const httpResponse: HTTPResponse = {
                data: error.response.data,
                status: error.response.status,
                statusText: error.response.statusText || 'Error',
                headers: (() => {
                  const headers: Record<string, string> = {};
                  if (error.response.headers) {
                    if (typeof error.response.headers.forEach === 'function') {
                      error.response.headers.forEach((value: string, key: string) => {
                        headers[key.toLowerCase()] = String(value);
                      });
                    } else {
                      Object.entries(error.response.headers).forEach(([key, value]) => {
                        headers[key.toLowerCase()] = String(value);
                      });
                    }
                  }
                  return headers;
                })(),
                config: error.response.config || {}
              };
              
              const errorRequestKey = (error.config as any)?.__mockifyer_requestKey;
              if (errorRequestKey && error.response?.config) {
                (httpResponse.config as any).__mockifyer_requestKey = errorRequestKey;
              }
              
              console.log('[Mockifyer] Recording error response for:', {
                method: error.response.config.method?.toUpperCase() || 'GET',
                url: error.response.config.url,
                status: error.response.status,
                requestKey: errorRequestKey || 'not found'
              });
              
              await mockifyer['saveResponse'](httpResponse);
            }
            return Promise.reject(error);
          }
        );
        console.log(`[Mockifyer] ✅ Response interceptor added to global axios with ID: ${interceptorId}`);
        
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

// Re-export types and utilities from core
export * from '@sgedda/mockifyer-core';

// Re-export axios types for convenience (but users should import axios directly)
export type { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosHeaders } from 'axios'; 