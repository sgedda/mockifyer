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
 * Generates a unique key for a request based on method, URL, and query parameters
 */
export function generateRequestKey(request: StoredRequest): string {
  const normalizedMethod = (request.method || 'GET').toUpperCase();
  const normalizedUrl = (request.url || '').toLowerCase();
  const queryString = request.queryParams 
    ? new URLSearchParams(request.queryParams as Record<string, string>).toString() 
    : '';
  return `${normalizedMethod}:${normalizedUrl}${queryString ? '?' + queryString : ''}`;
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

  // If no exact match and useSimilarMatch is true, try to find a similar match
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

