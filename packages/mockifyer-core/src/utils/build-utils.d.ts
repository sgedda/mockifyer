import { MockData } from '../types';
/**
 * Build-time utilities for using mock data during build processes.
 * Useful for static site generation, build-time data fetching, and embedding mock data.
 */
export interface BuildMockDataOptions {
    /** Path to mock data directory */
    mockDataPath: string;
    /** Filter function to select specific mock files */
    filter?: (filename: string, data: MockData) => boolean;
    /** Transform function to modify mock data before returning */
    transform?: (data: MockData, filename: string) => any;
    /** Whether to include request data */
    includeRequest?: boolean;
    /** Whether to include response data */
    includeResponse?: boolean;
    /** Whether to include metadata (timestamp, scenario, etc.) */
    includeMetadata?: boolean;
}
export interface BuildMockDataResult {
    /** Array of processed mock data */
    data: any[];
    /** Map of URL to mock data for quick lookup */
    byUrl: Map<string, any>;
    /** Map of method+URL to mock data */
    byMethodAndUrl: Map<string, any>;
    /** Total count of mock files */
    count: number;
}
/**
 * Load and process mock data files for use during build time.
 *
 * @example
 * ```typescript
 * // In Next.js getStaticProps
 * import { loadMockDataForBuild } from '@sgedda/mockifyer-core/utils/build-utils';
 *
 * export async function getStaticProps() {
 *   const mockData = loadMockDataForBuild({
 *     mockDataPath: './mock-data',
 *     filter: (filename, data) => data.request.method === 'GET',
 *     transform: (data) => data.response.data
 *   });
 *
 *   return {
 *     props: {
 *       posts: mockData.data
 *     }
 *   };
 * }
 * ```
 */
export declare function loadMockDataForBuild(options: BuildMockDataOptions): BuildMockDataResult;
/**
 * Get mock data for a specific URL.
 *
 * @example
 * ```typescript
 * const mockData = getMockDataByUrl('./mock-data', 'https://api.example.com/posts');
 * ```
 */
export declare function getMockDataByUrl(mockDataPath: string, url: string): any | null;
/**
 * Get mock data for a specific method and URL.
 *
 * @example
 * ```typescript
 * const mockData = getMockDataByMethodAndUrl('./mock-data', 'GET', 'https://api.example.com/posts');
 * ```
 */
export declare function getMockDataByMethodAndUrl(mockDataPath: string, method: string, url: string): any | null;
/**
 * Generate a static data file from mock data.
 * Useful for embedding mock data into build output.
 *
 * @example
 * ```typescript
 * // In build script
 * generateStaticDataFile({
 *   mockDataPath: './mock-data',
 *   outputPath: './public/static-data.json',
 *   transform: (data) => data.response.data
 * });
 * ```
 */
export declare function generateStaticDataFile(options: BuildMockDataOptions & {
    outputPath: string;
    format?: 'json' | 'typescript' | 'javascript';
    variableName?: string;
}): void;
/**
 * Generate TypeScript types from mock data structure.
 *
 * @example
 * ```typescript
 * generateTypesFromMockData({
 *   mockDataPath: './mock-data',
 *   outputPath: './types/mock-data.d.ts'
 * });
 * ```
 */
export declare function generateTypesFromMockData(options: {
    mockDataPath: string;
    outputPath: string;
    typeName?: string;
    filter?: (filename: string, data: MockData) => boolean;
}): void;
/**
 * Pre-process mock data for build-time use.
 * Useful for Next.js, Gatsby, or other static site generators.
 *
 * @example
 * ```typescript
 * // In build script or getStaticProps
 * const processedData = preprocessMockDataForBuild({
 *   mockDataPath: './mock-data',
 *   groupBy: 'endpoint', // or 'method', 'scenario', etc.
 *   sortBy: 'timestamp'
 * });
 * ```
 */
export declare function preprocessMockDataForBuild(options: BuildMockDataOptions & {
    groupBy?: 'endpoint' | 'method' | 'scenario' | 'session';
    sortBy?: 'timestamp' | 'filename' | 'url';
    sortOrder?: 'asc' | 'desc';
}): any;
//# sourceMappingURL=build-utils.d.ts.map