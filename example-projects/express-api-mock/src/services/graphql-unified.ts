import { HTTPClient, setupMockifyer } from '@sgedda/mockifyer';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string; locations?: any[]; path?: any[] }>;
}

// Cache for initialized Mockifyer instances (to avoid re-initializing)
const initializedCache = new Set<string>();

function getClientCacheKey(clientType: string, scope: string): string {
  return `${clientType}:${scope}`;
}

function ensureMockifyerInitialized(clientType: 'axios' | 'fetch', scope: 'local' | 'global'): void {
  const cacheKey = getClientCacheKey(clientType, scope);
  
  // Return if already initialized
  if (initializedCache.has(cacheKey)) {
    console.log(`[GraphQLUnified] Mockifyer already initialized for ${cacheKey}`);
    return;
  }

  // Resolve mock data path
  let mockDataPath: string;
  
  if (process.env.MOCKIFYER_PATH) {
    mockDataPath = path.isAbsolute(process.env.MOCKIFYER_PATH) 
      ? process.env.MOCKIFYER_PATH 
      : path.join(process.cwd(), process.env.MOCKIFYER_PATH);
  } else if (process.env.RAILWAY_ENVIRONMENT || fs.existsSync('/persisted/mock-data')) {
    mockDataPath = '/persisted/mock-data';
  } else {
    mockDataPath = path.join(process.cwd(), 'mock-data');
  }

  console.log(`[GraphQLUnified] Initializing Mockifyer:`, {
    clientType,
    scope,
    mockDataPath,
    mockEnabled: process.env.MOCKIFYER_ENABLED === 'true',
    mockRecord: process.env.MOCKIFYER_RECORD === 'true'
  });

  // Configure Mockifyer based on clientType and scope
  const config: any = {
    mockDataPath: mockDataPath,
    recordMode: process.env.MOCKIFYER_RECORD === 'true',
    failOnMissingMock: false,
    httpClientType: clientType,
    // For GraphQL, we want to match based on the query string in the body
    similarMatchRequiredParams: []
  };

  // Set global patching based on scope
  if (clientType === 'axios') {
    config.useGlobalAxios = scope === 'global';
    if (scope === 'global') {
      config.axiosInstance = axios;
    }
  } else if (clientType === 'fetch') {
    config.useGlobalFetch = scope === 'global';
  }

  // Add additional config options if Mockifyer is enabled
  if (process.env.MOCKIFYER_ENABLED === 'true') {
    config.recordSameEndpoints = process.env.MOCKIFYER_RECORD_SAME_ENDPOINTS === 'true';
    if (config.useSimilarMatch === undefined && process.env.MOCKIFYER_USE_SIMILAR_MATCH === 'true') {
      config.useSimilarMatch = true;
    }
    config.useSimilarMatchCheckResponse = process.env.MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE === 'true';
  }

  // Initialize Mockifyer (this patches global axios/fetch if scope is global)
  setupMockifyer(config);
  
  // Mark as initialized
  initializedCache.add(cacheKey);
  
  console.log(`[GraphQLUnified] Mockifyer initialized for ${cacheKey}`);
}

// Cache for HTTP clients (only used for local scope)
const clientCache = new Map<string, HTTPClient>();

function getHTTPClient(clientType: 'axios' | 'fetch'): HTTPClient {
  const cacheKey = getClientCacheKey(clientType, 'local');
  
  // Return cached client if available
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  // Resolve mock data path
  let mockDataPath: string;
  
  if (process.env.MOCKIFYER_PATH) {
    mockDataPath = path.isAbsolute(process.env.MOCKIFYER_PATH) 
      ? process.env.MOCKIFYER_PATH 
      : path.join(process.cwd(), process.env.MOCKIFYER_PATH);
  } else if (process.env.RAILWAY_ENVIRONMENT || fs.existsSync('/persisted/mock-data')) {
    mockDataPath = '/persisted/mock-data';
  } else {
    mockDataPath = path.join(process.cwd(), 'mock-data');
  }

  // Configure Mockifyer for local HTTP client
  const config: any = {
    mockDataPath: mockDataPath,
    recordMode: process.env.MOCKIFYER_RECORD === 'true',
    failOnMissingMock: false,
    httpClientType: clientType,
    useGlobalAxios: false,
    useGlobalFetch: false,
    // For GraphQL, we want to match based on the query string in the body
    similarMatchRequiredParams: []
  };

  // Add additional config options if Mockifyer is enabled
  if (process.env.MOCKIFYER_ENABLED === 'true') {
    config.recordSameEndpoints = process.env.MOCKIFYER_RECORD_SAME_ENDPOINTS === 'true';
    if (config.useSimilarMatch === undefined && process.env.MOCKIFYER_USE_SIMILAR_MATCH === 'true') {
      config.useSimilarMatch = true;
    }
    config.useSimilarMatchCheckResponse = process.env.MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE === 'true';
  }

  // Create HTTP client for local scope
  const httpClient: HTTPClient = setupMockifyer(config);
  
  // Cache the client
  clientCache.set(cacheKey, httpClient);
  
  return httpClient;
}

// Helper function to extract headers from axios/fetch response (same robust logic as weather-unified)
function extractHeaders(response: any, clientType: 'axios' | 'fetch', scope: 'local' | 'global'): Record<string, string> {
  const headers: Record<string, string> = {};
  let isMocked = false;

  if (scope === 'global' && clientType === 'axios') {
    // CRITICAL: Check config first - this is the most reliable way
    // The adapter sets __mockifyer_isMock on the config, which survives axios transformations
    const isMockedFromConfig = !!(response.config as any).__mockifyer_isMock;
    const preservedHeaders = (response.config as any).__mockifyer_headers as Record<string, string> | undefined;
    
    console.log('[GraphQLUnified] Mock detection from config:', {
      hasConfig: !!response.config,
      __mockifyer_isMock: (response.config as any).__mockifyer_isMock,
      isMocked: isMockedFromConfig,
      hasPreservedHeaders: !!preservedHeaders,
      preservedHeadersCount: preservedHeaders ? Object.keys(preservedHeaders).length : 0
    });
    
    const respHeaders = response.headers as any;
    
    // Start with config value - this is the most reliable
    let isMockedFromResponse = isMockedFromConfig;
    
    // Method 1: Try toJSON() first (most reliable if available)
    if (respHeaders && typeof respHeaders.toJSON === 'function') {
      try {
        const headersObj = respHeaders.toJSON();
        if (headersObj && typeof headersObj === 'object' && !Array.isArray(headersObj)) {
          Object.entries(headersObj).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              const lowerKey = key.toLowerCase();
              headers[lowerKey] = String(value);
              if (lowerKey === 'x-mockifyer') {
                isMockedFromResponse = String(value) === 'true';
              }
            }
          });
          if (Object.keys(headers).length > 0) {
            console.log('[GraphQLUnified] ✅ Extracted', Object.keys(headers).length, 'headers using toJSON()');
          }
        }
      } catch (e) {
        console.warn('[GraphQLUnified] toJSON() failed:', e);
      }
    }
    
    // Method 2: Try forEach if toJSON didn't work
    if (Object.keys(headers).length === 0 && respHeaders && typeof respHeaders.forEach === 'function') {
      respHeaders.forEach((value: string, key: string) => {
        if (value !== undefined && value !== null) {
          const lowerKey = key.toLowerCase();
          headers[lowerKey] = String(value);
          if (lowerKey === 'x-mockifyer') {
            isMockedFromResponse = String(value) === 'true';
          }
        }
      });
      if (Object.keys(headers).length > 0) {
        console.log('[GraphQLUnified] ✅ Extracted', Object.keys(headers).length, 'headers using forEach()');
      }
    }
    
    // Method 3: Try get() method for specific headers
    if (!isMockedFromResponse && respHeaders && typeof respHeaders.get === 'function') {
      try {
        const mockHeader = respHeaders.get('x-mockifyer');
        if (mockHeader !== undefined && mockHeader !== null) {
          isMockedFromResponse = String(mockHeader) === 'true' || mockHeader === true;
          headers['x-mockifyer'] = String(mockHeader);
          console.log('[GraphQLUnified] ✅ Found x-mockifyer using get():', mockHeader);
        }
      } catch (e) {
        console.warn('[GraphQLUnified] get() failed:', e);
      }
    }
    
    // Method 4: Try Object.entries as last resort (but skip if it's AxiosHeaders - won't work)
    if (Object.keys(headers).length === 0 && respHeaders && typeof respHeaders === 'object' && respHeaders.constructor?.name !== 'AxiosHeaders') {
      try {
        const entries = Object.entries(respHeaders);
        entries.forEach(([key, value]) => {
          if (value !== undefined && value !== null && typeof value === 'string') {
            const lowerKey = key.toLowerCase();
            headers[lowerKey] = String(value);
            if (lowerKey === 'x-mockifyer') {
              isMockedFromResponse = String(value) === 'true';
            }
          }
        });
        if (Object.keys(headers).length > 0) {
          console.log('[GraphQLUnified] ✅ Extracted', Object.keys(headers).length, 'headers using Object.entries()');
        }
      } catch (e) {
        console.warn('[GraphQLUnified] Object.entries() failed:', e);
      }
    }
    
    // If headers are empty but we have preserved headers from config, use those
    if (Object.keys(headers).length === 0 && preservedHeaders && Object.keys(preservedHeaders).length > 0) {
      console.log('[GraphQLUnified] ⚠️ Response headers empty, using preserved headers from config');
      Object.assign(headers, preservedHeaders);
      if (headers['x-mockifyer']) {
        isMockedFromResponse = headers['x-mockifyer'] === 'true';
      }
    }
    
    // Ensure x-mockifyer is set if we detected it's mocked
    if (isMockedFromResponse && !headers['x-mockifyer']) {
      headers['x-mockifyer'] = 'true';
      console.log('[GraphQLUnified] Added x-mockifyer header because isMockedFromResponse=true');
    }
    
    isMocked = isMockedFromResponse;
  } else {
    // For local scope or fetch, headers should be plain object
    if (response.headers) {
      Object.entries(response.headers).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          headers[key.toLowerCase()] = String(value);
          if (key.toLowerCase() === 'x-mockifyer') {
            isMocked = String(value) === 'true';
          }
        }
      });
    }
  }

  // Ensure x-mockifyer is set if we detected it's mocked
  if (isMocked && !headers['x-mockifyer']) {
    headers['x-mockifyer'] = 'true';
  }

  return headers;
}

export async function executeQueryUnified<T = any>(
  query: string,
  variables?: Record<string, any>,
  clientType: 'axios' | 'fetch' = 'axios',
  scope: 'local' | 'global' = 'local'
): Promise<{ data: GraphQLResponse<T>; headers: Record<string, string> }> {
  try {
    const baseUrl = process.env.GRAPHQL_API_URL || 'https://rickandmortyapi.com/graphql';

    // Ensure Mockifyer is initialized (patches global axios/fetch if scope is global)
    ensureMockifyerInitialized(clientType, scope);

    console.log('[GraphQLUnified] Making GraphQL request:', {
      url: baseUrl,
      queryLength: query.length,
      hasVariables: !!variables,
      clientType,
      scope,
      mockEnabled: process.env.MOCKIFYER_ENABLED === 'true',
      mockRecord: process.env.MOCKIFYER_RECORD === 'true'
    });

    let response: any;
    
    if (scope === 'global') {
      if (clientType === 'axios') {
        const axiosResponse = await axios.post(
          baseUrl,
          {
            query,
            variables: variables || {}
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        // Extract headers using robust logic
        const headers = extractHeaders(axiosResponse, clientType, scope);
        const isMocked = !!(axiosResponse.config as any).__mockifyer_isMock || headers['x-mockifyer'] === 'true';
        
        response = {
          data: axiosResponse.data,
          status: axiosResponse.status,
          statusText: axiosResponse.statusText,
          headers: headers,
          __isMocked: isMocked // Store mock status
        } as any;
      } else { // fetch
        const fetchResponse = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query,
            variables: variables || {}
          })
        });
        
        const data = await fetchResponse.json();
        const headers: Record<string, string> = {};
        fetchResponse.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });
        
        response = {
          data,
          status: fetchResponse.status,
          statusText: fetchResponse.statusText,
          headers
        };
      }
    } else { // local scope
      const httpClient = getHTTPClient(clientType);
      response = await httpClient.post(
        baseUrl,
        {
          query,
          variables: variables || {}
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Check for mockifyer header (case-insensitive)
    // First check __isMocked flag (set from config detection), then fall back to headers
    let isMocked = !!(response as any).__isMocked;
    const originalHeaders = (response as any).__originalHeaders || response.headers;
    
    // If not set from flag, check headers
    if (!isMocked && originalHeaders) {
      if (typeof originalHeaders.get === 'function') {
        const mockHeader = originalHeaders.get('x-mockifyer');
        isMocked = mockHeader === 'true' || mockHeader === true;
      } else if (originalHeaders['x-mockifyer'] || originalHeaders['X-Mockifyer'] || originalHeaders['X-MOCKIFYER']) {
        isMocked = String(originalHeaders['x-mockifyer'] || originalHeaders['X-Mockifyer'] || originalHeaders['X-MOCKIFYER']) === 'true';
      }
    }
    
    // Check converted headers as fallback
    if (!isMocked && response.headers) {
      isMocked = response.headers['x-mockifyer'] === 'true';
    }
    
    console.log('[GraphQLUnified] Received response:', {
      status: response.status,
      hasData: !!response.data,
      isMocked: isMocked,
      hasErrors: !!response.data?.errors
    });
    
    // Ensure x-mockifyer header is in final headers if mocked
    const finalHeaders: Record<string, string> = { ...(response.headers || {}) };
    if (isMocked) {
      finalHeaders['x-mockifyer'] = 'true';
      // Also extract other mock metadata if available
      if (originalHeaders) {
        if (typeof originalHeaders.get === 'function') {
          const timestamp = originalHeaders.get('x-mockifyer-timestamp');
          const filename = originalHeaders.get('x-mockifyer-filename');
          const filepath = originalHeaders.get('x-mockifyer-filepath');
          if (timestamp) finalHeaders['x-mockifyer-timestamp'] = String(timestamp);
          if (filename) finalHeaders['x-mockifyer-filename'] = String(filename);
          if (filepath) finalHeaders['x-mockifyer-filepath'] = String(filepath);
        } else {
          if (originalHeaders['x-mockifyer-timestamp']) finalHeaders['x-mockifyer-timestamp'] = String(originalHeaders['x-mockifyer-timestamp']);
          if (originalHeaders['x-mockifyer-filename']) finalHeaders['x-mockifyer-filename'] = String(originalHeaders['x-mockifyer-filename']);
          if (originalHeaders['x-mockifyer-filepath']) finalHeaders['x-mockifyer-filepath'] = String(originalHeaders['x-mockifyer-filepath']);
        }
      }
    }

    return {
      data: response.data as GraphQLResponse<T>,
      headers: finalHeaders
    };
  } catch (error: any) {
    console.error('[GraphQLUnified] Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      mockEnabled: process.env.MOCKIFYER_ENABLED,
      mockRecord: process.env.MOCKIFYER_RECORD
    });
    throw new Error(`Failed to execute GraphQL query: ${error.message}`);
  }
}

