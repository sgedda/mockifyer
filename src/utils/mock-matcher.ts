import { StoredRequest, MockData } from '../types';

export interface CachedMockData {
  mockData: MockData;
  filename: string;
  filePath: string;
}

export interface MockMatchingConfig {
  useSimilarMatch?: boolean;
  similarMatchRequiredParams?: string[];
}

/**
 * Normalizes GraphQL query by removing extra whitespace and formatting
 */
function normalizeGraphQLQuery(query: string): string {
  if (!query) return '';
  // Remove extra whitespace, newlines, and normalize spacing
  return query.replace(/\s+/g, ' ').trim();
}

/**
 * Generates a hash-like string from an object for consistent key generation
 */
function hashObject(obj: any): string {
  if (!obj) return '';
  try {
    // Sort keys and stringify to ensure consistent ordering
    const sorted = Object.keys(obj).sort().reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {} as Record<string, any>);
    return JSON.stringify(sorted);
  } catch (e) {
    return String(obj);
  }
}

/**
 * Generates a unique key for a request based on method, URL, query parameters, and body data
 */
export function generateRequestKey(request: StoredRequest): string {
  const normalizedMethod = (request.method || 'GET').toUpperCase();
  const normalizedUrl = (request.url || '').toLowerCase();
  const queryString = request.queryParams 
    ? new URLSearchParams(request.queryParams as Record<string, string>).toString() 
    : '';
  
  let key = `${normalizedMethod}:${normalizedUrl}${queryString ? '?' + queryString : ''}`;
  
  // CRITICAL DEBUG for GraphQL
  if (normalizedMethod === 'POST' && normalizedUrl.includes('graphql')) {
    console.log('[Mockifyer] 🔑 generateRequestKey - GraphQL request:', {
      method: normalizedMethod,
      url: normalizedUrl,
      hasData: !!request.data,
      dataType: typeof request.data,
      dataValue: request.data ? (typeof request.data === 'string' ? request.data.substring(0, 150) : JSON.stringify(request.data).substring(0, 150)) : 'UNDEFINED',
      currentKey: key
    });
  }
  
  // For POST/PUT/PATCH requests, include body data in the key
  // This is important for GraphQL and other POST requests where the body determines the response
  if (['POST', 'PUT', 'PATCH'].includes(normalizedMethod) && request.data) {
    try {
      let bodyData = request.data;
      
      // If body is a string, try to parse it as JSON (common for HTTP clients that stringify)
      if (typeof request.data === 'string') {
        try {
          bodyData = JSON.parse(request.data);
        } catch (e) {
          // If it's not valid JSON, use the string as-is
          bodyData = request.data;
        }
      }
      
      // Handle GraphQL requests specifically
      if (typeof bodyData === 'object' && bodyData !== null && bodyData.query) {
        const normalizedQuery = normalizeGraphQLQuery(bodyData.query);
        const variablesHash = bodyData.variables ? hashObject(bodyData.variables) : '';
        console.log('[Mockifyer] 🔷 GraphQL key generation:', {
          hasVariables: !!bodyData.variables,
          variables: bodyData.variables,
          variablesHash: variablesHash.substring(0, 100),
          queryPreview: normalizedQuery.substring(0, 50) + '...'
        });
        key += `|body:gql:${normalizedQuery}:vars:${variablesHash}`;
      } else {
        // For other POST requests, include a hash of the body
        const bodyHash = typeof bodyData === 'string' 
          ? bodyData 
          : hashObject(bodyData);
        key += `|body:${bodyHash}`;
      }
    } catch (e) {
      // If we can't serialize the body, use a string representation
      key += `|body:${String(request.data)}`;
    }
  }
  
  return key;
}

/**
 * Checks if a request exactly matches a mock based on method, URL, and all query parameters
 */
export function isExactMatch(
  request: StoredRequest,
  mockRequest: StoredRequest
): boolean {
  return generateRequestKey(request) === generateRequestKey(mockRequest);
}

/**
 * Checks if a request matches a mock based on path and method only (ignoring query params)
 */
export function isSimilarPathMatch(
  request: StoredRequest,
  mockRequest: StoredRequest
): boolean {
  try {
    const requestUrl = new URL(request.url);
    const mockUrl = new URL(mockRequest.url);
    const requestPath = requestUrl.pathname;
    const mockPath = mockUrl.pathname;
    
    return requestPath === mockPath && 
           (request.method || 'GET').toUpperCase() === (mockRequest.method || 'GET').toUpperCase();
  } catch (e) {
    return false;
  }
}

/**
 * Checks if required query parameters match between request and mock
 */
export function doRequiredParamsMatch(
  request: StoredRequest,
  mockRequest: StoredRequest,
  requiredParams: string[]
): boolean {
  if (!requiredParams || requiredParams.length === 0) {
    return true;
  }

  const requestParams = request.queryParams || {};
  const mockParams = mockRequest.queryParams || {};

  return requiredParams.every(paramName => {
    const requestValue = requestParams[paramName];
    const mockValue = mockParams[paramName];
    
    // Both must be present and equal, or both must be absent
    if (requestValue === undefined && mockValue === undefined) {
      return true;
    }
    
    // Convert to string for comparison (query params are usually strings)
    const requestStr = String(requestValue || '');
    const mockStr = String(mockValue || '');
    
    return requestStr === mockStr;
  });
}

/**
 * Checks if a request is a GraphQL request based on its body data
 */
function isGraphQLRequest(request: StoredRequest): boolean {
  if (!['POST', 'PUT', 'PATCH'].includes((request.method || 'GET').toUpperCase())) {
    return false;
  }
  
  if (!request.data) {
    return false;
  }
  
  try {
    let bodyData = request.data;
    
    // If body is a string, try to parse it as JSON
    if (typeof request.data === 'string') {
      try {
        bodyData = JSON.parse(request.data);
      } catch (e) {
        return false;
      }
    }
    
    // Check if it's a GraphQL request (has a 'query' field)
    return typeof bodyData === 'object' && bodyData !== null && typeof bodyData.query === 'string';
  } catch (e) {
    return false;
  }
}

/**
 * Finds the best matching mock for a given request
 * 
 * @param request - The request to find a mock for
 * @param mockCache - Map of request keys to cached mock data
 * @param config - Configuration for matching behavior
 * @returns The best matching mock, or undefined if no match found
 */
export function findBestMatchingMock(
  request: StoredRequest,
  mockCache: Map<string, CachedMockData>,
  config: MockMatchingConfig = {}
): CachedMockData | undefined {
  const requestKey = generateRequestKey(request);
  
  // Try exact match first
  const exactMatch = mockCache.get(requestKey);
  if (exactMatch) {
    return exactMatch;
  }

  // For GraphQL requests, only allow exact matches (query + variables must match exactly)
  // Never use similar matching for GraphQL as different queries/variables should be different mocks
  if (isGraphQLRequest(request)) {
    return undefined;
  }

  // If no exact match and useSimilarMatch is true, try to find a similar match
  // (This only applies to non-GraphQL requests)
  if (config.useSimilarMatch) {
    let requestPath: string;
    try {
      const requestUrl = new URL(request.url);
      requestPath = requestUrl.pathname;
    } catch (e) {
      return undefined;
    }
    
    // Find first matching path and method
    for (const [key, cachedMock] of mockCache.entries()) {
      const mockData = cachedMock.mockData;
      
      // Skip GraphQL mocks when doing similar matching
      if (isGraphQLRequest(mockData.request)) {
        continue;
      }
      
      let mockPath: string;
      try {
        const mockUrl = new URL(mockData.request.url);
        mockPath = mockUrl.pathname;
      } catch (e) {
        continue;
      }
      
      // Check if path and method match
      if (mockPath === requestPath && 
          (mockData.request.method || 'GET').toUpperCase() === (request.method || 'GET').toUpperCase()) {
        
        // Check if required parameters match (if configured)
        if (config.similarMatchRequiredParams && config.similarMatchRequiredParams.length > 0) {
          if (!doRequiredParamsMatch(request, mockData.request, config.similarMatchRequiredParams)) {
            // Required parameter differs, skip this mock
            continue;
          }
        }
        
        return cachedMock;
      }
    }
  }

  return undefined;
}

