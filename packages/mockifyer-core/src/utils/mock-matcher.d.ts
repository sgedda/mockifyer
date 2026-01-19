import { StoredRequest, MockData } from '../types';
export interface CachedMockData {
    mockData: MockData;
    filename: string;
    filePath: string;
}
export interface MockMatchingConfig {
    useSimilarMatch?: boolean;
    similarMatchRequiredParams?: string[];
    similarMatchIgnoreAllQueryParams?: boolean;
}
/**
 * Generates a unique key for a request based on method, URL, query parameters, and body data
 */
export declare function generateRequestKey(request: StoredRequest): string;
/**
 * Checks if a request exactly matches a mock based on method, URL, and all query parameters
 */
export declare function isExactMatch(request: StoredRequest, mockRequest: StoredRequest): boolean;
/**
 * Checks if a request matches a mock based on path and method only (ignoring query params)
 */
export declare function isSimilarPathMatch(request: StoredRequest, mockRequest: StoredRequest): boolean;
/**
 * Checks if required query parameters match between request and mock
 */
export declare function doRequiredParamsMatch(request: StoredRequest, mockRequest: StoredRequest, requiredParams: string[]): boolean;
/**
 * Finds the best matching mock for a given request
 *
 * @param request - The request to find a mock for
 * @param mockCache - Map of request keys to cached mock data
 * @param config - Configuration for matching behavior
 * @returns The best matching mock, or undefined if no match found
 */
export declare function findBestMatchingMock(request: StoredRequest, mockCache: Map<string, CachedMockData>, config?: MockMatchingConfig): CachedMockData | undefined;
//# sourceMappingURL=mock-matcher.d.ts.map