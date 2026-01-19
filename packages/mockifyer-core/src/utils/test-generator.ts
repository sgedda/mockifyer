import { MockData, StoredRequest } from '../types';

// Conditionally import path - will be undefined in React Native
let path: typeof import('path') | undefined;

try {
  path = require('path');
} catch (e) {
  // path not available (React Native environment)
  path = undefined;
}

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

export class TestGenerator {
  /**
   * Analyzes mock data and extracts test information
   */
  analyzeMock(mockData: MockData, httpClientType: 'fetch' | 'axios' = 'fetch'): TestInfo {
    const request = mockData.request;
    const response = mockData.response;
    
    // Extract endpoint from URL
    const endpoint = this.extractEndpoint(request.url);
    
    // Check if it's GraphQL
    const isGraphQL = this.isGraphQLRequest(request);
    let graphQLQuery: string | undefined;
    let graphQLVariables: any | undefined;
    
    if (isGraphQL && request.data) {
      const data = typeof request.data === 'string' ? JSON.parse(request.data) : request.data;
      graphQLQuery = data.query;
      graphQLVariables = data.variables;
    }
    
    return {
      method: request.method,
      url: request.url,
      endpoint,
      requestBody: request.data,
      queryParams: request.queryParams,
      responseStatus: response.status,
      responseData: response.data,
      responseHeaders: response.headers,
      scenario: mockData.scenario,
      usesAxios: httpClientType === 'axios',
      isGraphQL,
      graphQLQuery,
      graphQLVariables
    };
  }

  /**
   * Generates test code for a mock
   */
  generateTest(mockData: MockData, options: TestGenerationOptions = {}): string {
    const testInfo = this.analyzeMock(mockData, options.httpClientType);
    
    // Calculate test file path to determine relative path to mock-data
    const testFilePath = this.determineTestFilePath(mockData, options);
    
    switch (options.framework || 'jest') {
      case 'jest':
        return this.generateJestTest(testInfo, options, testFilePath);
      case 'vitest':
        return this.generateVitestTest(testInfo, options, testFilePath);
      case 'mocha':
        return this.generateMochaTest(testInfo, options, testFilePath);
      default:
        return this.generateJestTest(testInfo, options, testFilePath);
    }
  }

  /**
   * Generates Jest test code
   */
  private generateJestTest(testInfo: TestInfo, options: TestGenerationOptions, testFilePath: string): string {
    const testName = this.generateTestName(testInfo);
    const setupCode = options.includeSetup !== false ? this.generateSetup(testInfo, options, testFilePath) : '';
    const requestCode = this.generateRequestCode(testInfo, options);
    const assertions = this.generateAssertions(testInfo, options);
    
    return `
/**
 * Auto-generated test file for ${testInfo.method} ${testInfo.endpoint}
 * 
 * This test file sets up mocks for the underlying API request using Mockifyer.
 * The mocks are configured to return recorded responses, allowing you to:
 * 
 * 1. Test your application logic that depends on this API call
 * 2. Run tests without making real network requests
 * 3. Ensure consistent test results with predictable mock data
 * 
 * Example: Testing a function that depends on this API:
 * 
 *   import { fetchUserPosts } from '../src/api/posts';
 *   
 *   it('should process user posts correctly', async () => {
 *     // This will use the mocked response - no real API call is made
 *     const posts = await fetchUserPosts(${testInfo.queryParams?.userId || 'userId'});
 *     expect(posts).toHaveLength(${Array.isArray(testInfo.responseData) ? testInfo.responseData.length : 1});
 *     // Test your business logic here...
 *   });
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { setupMockifyer } from '@sgedda/mockifyer-${testInfo.usesAxios ? 'axios' : 'fetch'}';
${testInfo.usesAxios ? "import axios from 'axios';" : ''}

describe('${testInfo.endpoint}', () => {
  let mockifyer: any;

  /**
   * Set up Mockifyer to intercept and mock API requests
   * All fetch/axios calls matching this endpoint will return the recorded mock data
   */
  beforeAll(() => {
    ${setupCode}
  });

  /**
   * Example test: Verifies the mock is working correctly
   * 
   * This test demonstrates that the mock is set up and returns the expected data.
   * The test includes an assertion checking for the 'x-mockifyer' header, which
   * confirms that the response came from mock data and NOT a real API call.
   * 
   * You can use this as a reference, but the real value is testing your application
   * logic that depends on this API call.
   */
  it('${testName}', async () => {
    ${requestCode}
    
    ${assertions}
  });

  // TODO: Add tests for your application logic that depends on this API call
  // Example:
  // it('should handle the response in your component/service', async () => {
  //   const result = await yourFunctionThatUsesThisAPI();
  //   expect(result).toBeDefined();
  //   // Test your business logic...
  // });
});
`.trim();
  }

  /**
   * Generates Vitest test code
   */
  private generateVitestTest(testInfo: TestInfo, options: TestGenerationOptions, testFilePath: string): string {
    const testName = this.generateTestName(testInfo);
    const setupCode = options.includeSetup !== false ? this.generateSetup(testInfo, options, testFilePath) : '';
    const requestCode = this.generateRequestCode(testInfo, options);
    const assertions = this.generateAssertions(testInfo, options);
    
    return `
/**
 * Auto-generated test file for ${testInfo.method} ${testInfo.endpoint}
 * 
 * This test file sets up mocks for the underlying API request using Mockifyer.
 * The mocks are configured to return recorded responses, allowing you to:
 * 
 * 1. Test your application logic that depends on this API call
 * 2. Run tests without making real network requests
 * 3. Ensure consistent test results with predictable mock data
 * 
 * Example: Testing a function that depends on this API:
 * 
 *   import { fetchUserPosts } from '../src/api/posts';
 *   
 *   it('should process user posts correctly', async () => {
 *     // This will use the mocked response - no real API call is made
 *     const posts = await fetchUserPosts(${testInfo.queryParams?.userId || 'userId'});
 *     expect(posts).toHaveLength(${Array.isArray(testInfo.responseData) ? testInfo.responseData.length : 1});
 *     // Test your business logic here...
 *   });
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { setupMockifyer } from '@sgedda/mockifyer-${testInfo.usesAxios ? 'axios' : 'fetch'}';
${testInfo.usesAxios ? "import axios from 'axios';" : ''}

describe('${testInfo.endpoint}', () => {
  let mockifyer: any;

  /**
   * Set up Mockifyer to intercept and mock API requests
   * All fetch/axios calls matching this endpoint will return the recorded mock data
   */
  beforeAll(() => {
    ${setupCode}
  });

  /**
   * Example test: Verifies the mock is working correctly
   * 
   * This test demonstrates that the mock is set up and returns the expected data.
   * The test includes an assertion checking for the 'x-mockifyer' header, which
   * confirms that the response came from mock data and NOT a real API call.
   * 
   * You can use this as a reference, but the real value is testing your application
   * logic that depends on this API call.
   */
  it('${testName}', async () => {
    ${requestCode}
    
    ${assertions}
  });

  // TODO: Add tests for your application logic that depends on this API call
  // Example:
  // it('should handle the response in your component/service', async () => {
  //   const result = await yourFunctionThatUsesThisAPI();
  //   expect(result).toBeDefined();
  //   // Test your business logic...
  // });
});
`.trim();
  }

  /**
   * Generates Mocha test code
   */
  private generateMochaTest(testInfo: TestInfo, options: TestGenerationOptions, testFilePath: string): string {
    const testName = this.generateTestName(testInfo);
    const setupCode = options.includeSetup !== false ? this.generateSetup(testInfo, options, testFilePath) : '';
    const requestCode = this.generateRequestCode(testInfo, options);
    const assertions = this.generateAssertions(testInfo, options);
    
    return `
/**
 * Auto-generated test file for ${testInfo.method} ${testInfo.endpoint}
 * 
 * This test file sets up mocks for the underlying API request using Mockifyer.
 * The mocks are configured to return recorded responses, allowing you to:
 * 
 * 1. Test your application logic that depends on this API call
 * 2. Run tests without making real network requests
 * 3. Ensure consistent test results with predictable mock data
 * 
 * Example: Testing a function that depends on this API:
 * 
 *   import { fetchUserPosts } from '../src/api/posts';
 *   
 *   it('should process user posts correctly', async () => {
 *     // This will use the mocked response - no real API call is made
 *     const posts = await fetchUserPosts(${testInfo.queryParams?.userId || 'userId'});
 *     expect(posts).to.have.length(${Array.isArray(testInfo.responseData) ? testInfo.responseData.length : 1});
 *     // Test your business logic here...
 *   });
 */
import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import { setupMockifyer } from '@sgedda/mockifyer-${testInfo.usesAxios ? 'axios' : 'fetch'}';
${testInfo.usesAxios ? "import axios from 'axios';" : ''}

describe('${testInfo.endpoint}', () => {
  let mockifyer: any;

  /**
   * Set up Mockifyer to intercept and mock API requests
   * All fetch/axios calls matching this endpoint will return the recorded mock data
   */
  before(() => {
    ${setupCode}
  });

  /**
   * Example test: Verifies the mock is working correctly
   * 
   * This test demonstrates that the mock is set up and returns the expected data.
   * The test includes an assertion checking for the 'x-mockifyer' header, which
   * confirms that the response came from mock data and NOT a real API call.
   * 
   * You can use this as a reference, but the real value is testing your application
   * logic that depends on this API call.
   */
  it('${testName}', async () => {
    ${requestCode}
    
    ${assertions}
  });

  // TODO: Add tests for your application logic that depends on this API call
  // Example:
  // it('should handle the response in your component/service', async () => {
  //   const result = await yourFunctionThatUsesThisAPI();
  //   expect(result).to.be.defined;
  //   // Test your business logic...
  // });
});
`.trim();
  }

  /**
   * Generates setup code for tests
   */
  private generateSetup(testInfo: TestInfo, options: TestGenerationOptions, testFilePath: string): string {
    // Calculate relative path from test file location to mock-data directory
    // Skip path operations if path module is not available (React Native)
    if (!path) {
      // Fallback: use simple relative path calculation
      const mockDataPathFromOptions = options.mockDataPath || './mock-data';
      return `const mockDataPath = '${mockDataPathFromOptions}';`;
    }

    // testFilePath is relative to project root (e.g., './tests/generated/posts_71/posts_71.test.ts')
    // mockDataPath is relative to project root (e.g., './mock-data')
    const mockDataPathFromOptions = options.mockDataPath || './mock-data';
    
    // Get the directory containing the test file (remove filename)
    const testFileDir = path.dirname(testFilePath);
    
    // Calculate relative path from test file directory to mock-data directory
    // path.relative returns the relative path from testFileDir to mockDataPathFromOptions
    // e.g., from './tests/generated/posts_71' to './mock-data' -> '../../../../mock-data'
    // But we need to normalize paths first
    const normalizedTestDir = path.normalize(testFileDir);
    const normalizedMockDataPath = path.normalize(mockDataPathFromOptions);
    
    // Calculate relative path
    let relativePath = path.relative(normalizedTestDir, normalizedMockDataPath);
    
    // Normalize to use forward slashes (works on all platforms)
    relativePath = relativePath.replace(/\\/g, '/');
    
    // If paths are the same or mock-data is in a parent directory, ensure we have a valid relative path
    if (!relativePath || relativePath === '.' || relativePath === '..') {
      // Fallback: calculate based on depth
      const testDepth = normalizedTestDir.split(path.sep).filter((p: string) => p && p !== '.').length;
      relativePath = '../'.repeat(testDepth) + 'mock-data';
    }
    
    // Use path.resolve(__dirname, ...) to ensure correct resolution regardless of working directory
    // This ensures the path resolves correctly even when tests are run from different directories
    const pathRequire = "const path = require('path');";
    const pathResolution = `const mockDataPath = path.resolve(__dirname, '${relativePath}');`;
    
    // Note: scenario is not a direct property in MockifyerConfig
    // It's handled via scenarios.default or setScenario() method
    // For simplicity, we'll omit it and use the default scenario
    // Set failOnMissingMock to true to ensure tests fail if mock data is not found
    // This prevents accidental real API calls during testing
    // Enable similarMatch to ignore query params when matching (allows ?_limit=5 to match mocks without it)
    if (testInfo.usesAxios) {
      return `${pathRequire}
    ${pathResolution}
    mockifyer = setupMockifyer({
      mockDataPath: mockDataPath,
      recordMode: false,
      useGlobalAxios: true,
      axiosInstance: axios,
      failOnMissingMock: true,
      useSimilarMatch: true,
      similarMatchIgnoreAllQueryParams: true
    });`;
    } else {
      return `${pathRequire}
    ${pathResolution}
    mockifyer = setupMockifyer({
      mockDataPath: mockDataPath,
      recordMode: false,
      useGlobalFetch: true,
      failOnMissingMock: true,
      useSimilarMatch: true,
      similarMatchIgnoreAllQueryParams: true
    });`;
    }
  }

  /**
   * Generates request code
   */
  private generateRequestCode(testInfo: TestInfo, options: TestGenerationOptions): string {
    if (testInfo.isGraphQL) {
      return this.generateGraphQLRequest(testInfo, options);
    }
    
    switch (testInfo.method.toUpperCase()) {
      case 'GET':
        return this.generateGETRequest(testInfo, options);
      case 'POST':
        return this.generatePOSTRequest(testInfo, options);
      case 'PUT':
        return this.generatePUTRequest(testInfo, options);
      case 'PATCH':
        return this.generatePATCHRequest(testInfo, options);
      case 'DELETE':
        return this.generateDELETERequest(testInfo, options);
      default:
        return this.generateGETRequest(testInfo, options);
    }
  }

  /**
   * Generates GET request code
   */
  private generateGETRequest(testInfo: TestInfo, options: TestGenerationOptions): string {
    const url = this.formatUrl(testInfo.url, testInfo.queryParams);
    
    if (testInfo.usesAxios) {
      return `const response = await axios.get('${url}');`;
    } else {
      return `const response = await fetch('${url}');
    const data = await response.json();`;
    }
  }

  /**
   * Generates POST request code
   */
  private generatePOSTRequest(testInfo: TestInfo, options: TestGenerationOptions): string {
    const url = testInfo.url;
    const body = this.formatRequestBody(testInfo.requestBody);
    
    if (testInfo.usesAxios) {
      return `const response = await axios.post('${url}', ${body});`;
    } else {
      return `const response = await fetch('${url}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(${body})
    });
    const data = await response.json();`;
    }
  }

  /**
   * Generates PUT request code
   */
  private generatePUTRequest(testInfo: TestInfo, options: TestGenerationOptions): string {
    const url = testInfo.url;
    const body = this.formatRequestBody(testInfo.requestBody);
    
    if (testInfo.usesAxios) {
      return `const response = await axios.put('${url}', ${body});`;
    } else {
      return `const response = await fetch('${url}', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(${body})
    });
    const data = await response.json();`;
    }
  }

  /**
   * Generates PATCH request code
   */
  private generatePATCHRequest(testInfo: TestInfo, options: TestGenerationOptions): string {
    const url = testInfo.url;
    const body = this.formatRequestBody(testInfo.requestBody);
    
    if (testInfo.usesAxios) {
      return `const response = await axios.patch('${url}', ${body});`;
    } else {
      return `const response = await fetch('${url}', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(${body})
    });
    const data = await response.json();`;
    }
  }

  /**
   * Generates DELETE request code
   */
  private generateDELETERequest(testInfo: TestInfo, options: TestGenerationOptions): string {
    const url = this.formatUrl(testInfo.url, testInfo.queryParams);
    
    if (testInfo.usesAxios) {
      return `const response = await axios.delete('${url}');`;
    } else {
      return `const response = await fetch('${url}', {
      method: 'DELETE'
    });
    const data = await response.json();`;
    }
  }

  /**
   * Generates GraphQL request code
   */
  private generateGraphQLRequest(testInfo: TestInfo, options: TestGenerationOptions): string {
    const url = testInfo.url;
    const query = testInfo.graphQLQuery || '';
    const variables = testInfo.graphQLVariables || {};
    
    if (testInfo.usesAxios) {
      return `const response = await axios.post('${url}', {
      query: \`${this.escapeTemplateString(query)}\`,
      variables: ${JSON.stringify(variables, null, 6)}
    });`;
    } else {
      return `const response = await fetch('${url}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: \`${this.escapeTemplateString(query)}\`,
        variables: ${JSON.stringify(variables, null, 8)}
      })
    });
    const data = await response.json();`;
    }
  }

  /**
   * Generates assertions
   */
  private generateAssertions(testInfo: TestInfo, options: TestGenerationOptions): string {
    const assertions: string[] = [];
    const framework = options.framework || 'jest';
    
    // CRITICAL: Verify that the response came from mock data, not a real API call
    // Mockifyer adds 'x-mockifyer: true' header to all mocked responses
    if (testInfo.usesAxios) {
      if (framework === 'mocha') {
        assertions.push(`// Verify this response came from mock data (not a real API call)`);
        assertions.push(`expect(response.headers['x-mockifyer']).to.equal('true');`);
      } else {
        assertions.push(`// Verify this response came from mock data (not a real API call)`);
        assertions.push(`expect(response.headers['x-mockifyer']).toBe('true');`);
      }
    } else {
      // Fetch API - use .get() method
      if (framework === 'mocha') {
        assertions.push(`// Verify this response came from mock data (not a real API call)`);
        assertions.push(`expect(response.headers.get('x-mockifyer')).to.equal('true');`);
      } else {
        assertions.push(`// Verify this response came from mock data (not a real API call)`);
        assertions.push(`expect(response.headers.get('x-mockifyer')).toBe('true');`);
      }
    }
    
    // Status assertion
    if (framework === 'mocha') {
      assertions.push(`expect(response.status).to.equal(${testInfo.responseStatus});`);
    } else {
      assertions.push(`expect(response.status).toBe(${testInfo.responseStatus});`);
    }
    
    // Data assertion
    if (testInfo.responseData !== undefined && testInfo.responseData !== null) {
      const expectedData = JSON.stringify(testInfo.responseData, null, 2);
      const dataVar = testInfo.usesAxios ? 'response.data' : 'data';
      
      if (framework === 'mocha') {
        assertions.push(`expect(${dataVar}).to.deep.equal(${expectedData});`);
      } else {
        assertions.push(`expect(${dataVar}).toEqual(${expectedData});`);
      }
    }
    
    // Headers assertion (if important)
    // Note: Fetch API Headers object uses .get() method, not bracket notation
    if (testInfo.responseHeaders && Object.keys(testInfo.responseHeaders).length > 0) {
      const importantHeaders = ['content-type', 'authorization'];
      
      // Normalize header keys to lowercase for case-insensitive matching
      const normalizedHeaders: Record<string, string> = {};
      Object.keys(testInfo.responseHeaders).forEach(key => {
        normalizedHeaders[key.toLowerCase()] = testInfo.responseHeaders[key];
      });
      
      importantHeaders.forEach(header => {
        const headerLower = header.toLowerCase();
        if (normalizedHeaders[headerLower]) {
          const headerValue = normalizedHeaders[headerLower];
          // For fetch API, use .get() method; for axios, use bracket notation
          if (testInfo.usesAxios) {
            if (framework === 'mocha') {
              assertions.push(`expect(response.headers['${header}']).to.equal('${headerValue}');`);
            } else {
              assertions.push(`expect(response.headers['${header}']).toBe('${headerValue}');`);
            }
          } else {
            // Fetch API - use .get() method
            if (framework === 'mocha') {
              assertions.push(`expect(response.headers.get('${header}')).to.equal('${headerValue}');`);
            } else {
              assertions.push(`expect(response.headers.get('${header}')).toBe('${headerValue}');`);
            }
          }
        }
      });
    }
    
    return assertions.join('\n    ');
  }

  /**
   * Generates test name from endpoint
   */
  private generateTestName(testInfo: TestInfo): string {
    const method = testInfo.method.toUpperCase();
    const endpoint = testInfo.endpoint;
    
    if (testInfo.isGraphQL && testInfo.graphQLQuery) {
      // Extract operation name from GraphQL query
      const operationMatch = testInfo.graphQLQuery.match(/(?:query|mutation|subscription)\s+(\w+)/);
      if (operationMatch) {
        return `should execute ${operationMatch[1]} query`;
      }
      return 'should execute GraphQL query';
    }
    
    return `should ${method} ${endpoint}`;
  }

  /**
   * Extracts endpoint from URL
   */
  private extractEndpoint(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname || '/';
    } catch {
      // If URL parsing fails, try to extract path manually
      const match = url.match(/https?:\/\/[^\/]+(\/.*)?/);
      return match ? (match[1] || '/') : url;
    }
  }

  /**
   * Formats URL with query parameters
   */
  private formatUrl(url: string, queryParams?: Record<string, string>): string {
    if (!queryParams || Object.keys(queryParams).length === 0) {
      return url;
    }
    
    try {
      const urlObj = new URL(url);
      Object.entries(queryParams).forEach(([key, value]) => {
        urlObj.searchParams.append(key, value);
      });
      return urlObj.toString();
    } catch {
      // If URL parsing fails, append query string manually
      const params = new URLSearchParams(queryParams);
      return `${url}?${params.toString()}`;
    }
  }

  /**
   * Formats request body for code generation
   */
  private formatRequestBody(body: any): string {
    if (body === undefined || body === null) {
      return 'undefined';
    }
    
    if (typeof body === 'string') {
      try {
        // Try to parse as JSON to format it nicely
        const parsed = JSON.parse(body);
        return JSON.stringify(parsed, null, 2);
      } catch {
        // If not JSON, return as string literal
        return `'${this.escapeString(body)}'`;
      }
    }
    
    return JSON.stringify(body, null, 2);
  }

  /**
   * Checks if request is GraphQL
   */
  private isGraphQLRequest(request: StoredRequest): boolean {
    if (!['POST', 'PUT', 'PATCH'].includes(request.method.toUpperCase())) {
      return false;
    }
    
    if (!request.data) {
      return false;
    }
    
    try {
      const data = typeof request.data === 'string' ? JSON.parse(request.data) : request.data;
      return typeof data === 'object' && data !== null && 'query' in data;
    } catch {
      return false;
    }
  }

  /**
   * Escapes string for use in template literals
   */
  private escapeTemplateString(str: string): string {
    return str.replace(/`/g, '\\`').replace(/\${/g, '\\${');
  }

  /**
   * Escapes string for use in single quotes
   */
  private escapeString(str: string): string {
    return str.replace(/'/g, "\\'").replace(/\\/g, '\\\\');
  }

  /**
   * Extracts base endpoint path without IDs (for uniqueTestsPerEndpoint)
   * Examples:
   *   /posts/31 -> /posts
   *   /users/5/todos -> /users/todos
   *   /posts -> /posts (no change)
   */
  private extractBaseEndpoint(endpoint: string): string {
    // Split by / and filter out empty strings
    const parts = endpoint.split('/').filter(p => p);
    
    // If endpoint is just "/", return it
    if (parts.length === 0) {
      return '/';
    }
    
    // Remove the last segment if it looks like an ID (numeric)
    // This handles cases like /posts/31, /users/5/todos
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      // Check if last part is numeric (ID)
      if (/^\d+$/.test(lastPart)) {
        parts.pop();
      }
    }
    
    return '/' + parts.join('/');
  }

  /**
   * Determines test file path based on grouping strategy
   */
  determineTestFilePath(mockData: MockData, options: TestGenerationOptions): string {
    const testInfo = this.analyzeMock(mockData, options.httpClientType);
    const outputPath = options.outputPath || './tests/generated';
    const pattern = options.testPattern || '{endpoint}.test.ts';
    
    // If uniqueTestsPerEndpoint is enabled, normalize endpoint to base path (without IDs)
    const endpointToUse = options.uniqueTestsPerEndpoint 
      ? this.extractBaseEndpoint(testInfo.endpoint)
      : testInfo.endpoint;
    
    let fileName = pattern;
    
    // Replace placeholders
    fileName = fileName.replace('{endpoint}', this.sanitizeFileName(endpointToUse));
    fileName = fileName.replace('{method}', testInfo.method.toLowerCase());
    fileName = fileName.replace('{scenario}', testInfo.scenario || 'default');
    
    // Group by strategy
    if (options.groupBy === 'endpoint') {
      const dir = this.sanitizeFileName(endpointToUse);
      return `${outputPath}/${dir}/${fileName}`;
    } else if (options.groupBy === 'scenario') {
      const dir = testInfo.scenario || 'default';
      return `${outputPath}/scenarios/${dir}/${fileName}`;
    } else {
      // Group by file (default)
      return `${outputPath}/${fileName}`;
    }
  }

  /**
   * Sanitizes string for use in file names
   */
  private sanitizeFileName(str: string): string {
    return str
      .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
      .replace(/[^a-zA-Z0-9]/g, '_') // Replace non-alphanumeric with underscore
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
  }
}

