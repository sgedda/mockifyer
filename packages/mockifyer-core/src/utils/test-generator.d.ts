import { MockData } from '../types';
export type TestFramework = 'jest' | 'vitest' | 'mocha';
export interface TestGenerationOptions {
    framework?: TestFramework;
    outputPath?: string;
    testPattern?: string;
    includeSetup?: boolean;
    groupBy?: 'endpoint' | 'scenario' | 'file';
    httpClientType?: 'fetch' | 'axios';
    /** Path to mock data directory (default: './mock-data') */
    mockDataPath?: string;
    /** If true, only generate one test per endpoint (method + pathname), ignoring query parameters */
    uniqueTestsPerEndpoint?: boolean;
}
export interface TestInfo {
    method: string;
    url: string;
    endpoint: string;
    requestBody?: any;
    queryParams?: Record<string, string>;
    responseStatus: number;
    responseData: any;
    responseHeaders: Record<string, string>;
    scenario?: string;
    usesAxios: boolean;
    isGraphQL: boolean;
    graphQLQuery?: string;
    graphQLVariables?: any;
}
export declare class TestGenerator {
    /**
     * Analyzes mock data and extracts test information
     */
    analyzeMock(mockData: MockData, httpClientType?: 'fetch' | 'axios'): TestInfo;
    /**
     * Generates test code for a mock
     */
    generateTest(mockData: MockData, options?: TestGenerationOptions): string;
    /**
     * Generates Jest test code
     */
    private generateJestTest;
    /**
     * Generates Vitest test code
     */
    private generateVitestTest;
    /**
     * Generates Mocha test code
     */
    private generateMochaTest;
    /**
     * Generates setup code for tests
     */
    private generateSetup;
    /**
     * Generates request code
     */
    private generateRequestCode;
    /**
     * Generates GET request code
     */
    private generateGETRequest;
    /**
     * Generates POST request code
     */
    private generatePOSTRequest;
    /**
     * Generates PUT request code
     */
    private generatePUTRequest;
    /**
     * Generates PATCH request code
     */
    private generatePATCHRequest;
    /**
     * Generates DELETE request code
     */
    private generateDELETERequest;
    /**
     * Generates GraphQL request code
     */
    private generateGraphQLRequest;
    /**
     * Generates assertions
     */
    private generateAssertions;
    /**
     * Generates test name from endpoint
     */
    private generateTestName;
    /**
     * Extracts endpoint from URL
     */
    private extractEndpoint;
    /**
     * Formats URL with query parameters
     */
    private formatUrl;
    /**
     * Formats request body for code generation
     */
    private formatRequestBody;
    /**
     * Checks if request is GraphQL
     */
    private isGraphQLRequest;
    /**
     * Escapes string for use in template literals
     */
    private escapeTemplateString;
    /**
     * Escapes string for use in single quotes
     */
    private escapeString;
    /**
     * Extracts base endpoint path without IDs (for uniqueTestsPerEndpoint)
     * Examples:
     *   /posts/31 -> /posts
     *   /users/5/todos -> /users/todos
     *   /posts -> /posts (no change)
     */
    private extractBaseEndpoint;
    /**
     * Determines test file path based on grouping strategy
     */
    determineTestFilePath(mockData: MockData, options: TestGenerationOptions): string;
    /**
     * Sanitizes string for use in file names
     */
    private sanitizeFileName;
}
//# sourceMappingURL=test-generator.d.ts.map