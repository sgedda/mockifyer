/**
 * Programmatic API for drift checking.
 * Loads mocks from a scenario folder and compares them with live API responses.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MockData, StoredRequest } from '../../types';
import {
  DriftCheckReport,
  DriftCheckOptions,
  MockDriftReport,
} from './drift-report';
import { compareResponses, hasBreakingIssues } from './compare-engine';
import { omitProxyUpstreamRequestHeaders } from '../proxy-upstream-headers';

interface LoadedMock {
  mock: MockData;
  filePath: string;
}

/**
 * Main entry point for drift checking.
 * Auto-detects mock data path if not provided.
 */
export async function checkDrift(options: {
  scenario?: string;
  mockDataPath?: string;
  driftOptions?: DriftCheckOptions;
}): Promise<DriftCheckReport> {
  const {
    scenario = 'default',
    mockDataPath = detectMockDataPath(),
    driftOptions = {},
  } = options;

  const scenarioPath = path.join(mockDataPath, scenario);

  // Validate scenario path exists
  if (!fs.existsSync(scenarioPath)) {
    throw new Error(
      `Scenario path not found: ${scenarioPath}. ` +
        `Make sure mock data exists in '${mockDataPath}/${scenario}/'.`
    );
  }

  // Load all mocks from the scenario
  const mocks = loadMocksFromScenario(scenarioPath);

  if (mocks.length === 0) {
    throw new Error(
      `No mocks found in scenario '${scenario}' at ${scenarioPath}. ` +
        `Record some mocks first using Mockifyer's record mode.`
    );
  }

  // Check each mock
  const mockReports: MockDriftReport[] = [];
  const concurrency = driftOptions.concurrency || 5;
  const delayMs = driftOptions.delayMs || 0;

  // Process in batches for concurrency control
  for (let i = 0; i < mocks.length; i += concurrency) {
    const batch = mocks.slice(i, i + concurrency);
    const batchPromises = batch.map((loadedMock) =>
      checkSingleMock(loadedMock, driftOptions)
    );

    const batchResults = await Promise.all(batchPromises);
    mockReports.push(...batchResults);

    // Rate limiting delay between batches
    if (delayMs > 0 && i + concurrency < mocks.length) {
      await sleep(delayMs);
    }
  }

  // Generate summary
  const driftedMocks = mockReports.filter((r) => r.hasDrift && !r.skipped).length;
  const breakingDriftCount = mockReports.filter(
    (r) => r.hasBreakingDrift && !r.skipped
  ).length;
  const warningOnlyCount = mockReports.filter(
    (r) => r.hasDrift && !r.hasBreakingDrift && !r.skipped
  ).length;
  const skippedCount = mockReports.filter((r) => r.skipped).length;

  let summary: string;
  if (driftedMocks === 0 && skippedCount === 0) {
    summary = `✓ No drift detected in ${mocks.length} mocks`;
  } else if (driftedMocks === 0 && skippedCount > 0) {
    summary = `✓ No drift detected in ${mocks.length - skippedCount} mocks (${skippedCount} skipped)`;
  } else {
    const parts: string[] = [];
    if (breakingDriftCount > 0) {
      parts.push(`${breakingDriftCount} breaking`);
    }
    if (warningOnlyCount > 0) {
      parts.push(`${warningOnlyCount} warning${warningOnlyCount === 1 ? '' : 's'}`);
    }
    const driftSuffix = parts.join(', ');
    summary = `✗ ${driftedMocks} of ${mocks.length} mocks drifted: ${driftSuffix}`;
    if (skippedCount > 0) {
      summary += ` (${skippedCount} skipped)`;
    }
  }

  return {
    totalMocks: mocks.length,
    driftedMocks,
    breakingDriftCount,
    warningOnlyCount,
    skippedCount,
    mockReports,
    summary,
  };
}

/**
 * Check a single mock against the live API.
 */
async function checkSingleMock(
  loadedMock: LoadedMock,
  options: DriftCheckOptions
): Promise<MockDriftReport> {
  const { mock, filePath } = loadedMock;
  const { method, url } = mock.request;

  // Skip non-GET requests unless explicitly allowed
  if (!options.allowUnsafeMethods && method.toUpperCase() !== 'GET') {
    return {
      method,
      url,
      mockFilePath: filePath,
      hasDrift: false,
      hasBreakingDrift: false,
      issues: [],
      skipped: true,
      skipReason: `Skipped ${method} request (use --allow-unsafe-methods to check non-GET requests)`,
    };
  }

  try {
    // Build request URL
    const requestUrl = options.baseUrl ? rewriteUrl(url, options.baseUrl) : url;

    // Make live request
    const timeoutMs = options.timeoutMs || 10000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const sanitizedMockHeaders = omitProxyUpstreamRequestHeaders(mock.request.headers || {});
      const filteredHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(sanitizedMockHeaders)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey !== 'authorization' && !lowerKey.startsWith('x-mockifyer-')) {
          filteredHeaders[key] = value;
        }
      }

      const requestInit: RequestInit = {
        method,
        headers: {
          ...filteredHeaders,
          ...(options.headers || {}),
        },
        signal: controller.signal,
      };

      // Include request body for POST/PUT/PATCH/DELETE
      if (mock.request.data && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
        const isObject = typeof mock.request.data === 'object' && mock.request.data !== null;
        requestInit.body = typeof mock.request.data === 'string'
          ? mock.request.data
          : JSON.stringify(mock.request.data);
        
        if (isObject && !requestInit.headers['content-type'] && !requestInit.headers['Content-Type']) {
          requestInit.headers['content-type'] = 'application/json';
        }
      }

      const response = await fetch(requestUrl, requestInit);

      clearTimeout(timeout);

      // Parse response body
      const actualBody = await parseResponseBody(response);

      // Compare with mock
      const issues = compareResponses(
        {
          expectedStatus: mock.response.status,
          actualStatus: response.status,
          expectedBody: mock.response.data,
          actualBody,
        },
        options
      );

      return {
        method,
        url,
        mockFilePath: filePath,
        hasDrift: issues.length > 0,
        hasBreakingDrift: hasBreakingIssues(issues),
        issues,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error: any) {
    // Network or timeout error - report as skipped
    const errorMessage = error.name === 'AbortError'
      ? `Request timeout (${options.timeoutMs || 10000}ms)`
      : `Network error: ${error.code || error.message}`;

    return {
      method,
      url,
      mockFilePath: filePath,
      hasDrift: false,
      hasBreakingDrift: false,
      issues: [],
      skipped: true,
      skipReason: errorMessage,
    };
  }
}

/**
 * Parse response body, attempting JSON first.
 */
async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return await response.text();
}

/**
 * Rewrite a URL with a new base URL.
 */
function rewriteUrl(originalUrl: string, baseUrl: string): string {
  try {
    const original = new URL(originalUrl);
    const base = new URL(baseUrl);

    // Preserve base pathname when present, removing trailing slash to avoid duplication
    let basePath = base.pathname !== '/' ? base.pathname : '';
    if (basePath.endsWith('/')) {
      basePath = basePath.slice(0, -1);
    }
    return `${base.protocol}//${base.host}${basePath}${original.pathname}${original.search}`;
  } catch {
    // Fallback: simple replacement
    return originalUrl;
  }
}

/**
 * Load all mock JSON files from a scenario directory recursively.
 */
function loadMocksFromScenario(scenarioPath: string): LoadedMock[] {
  const mocks: LoadedMock[] = [];

  function walkDir(dirPath: string) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const mock = JSON.parse(content) as MockData;

          // Validate it's a mock file (has request and response)
          // Skip request-only stubs (responsePending or status 0 with null data)
          if (mock.request && mock.response) {
            const isRequestOnlyStub = 
              mock.responsePending === true ||
              (mock.response.status === 0 && mock.response.data === null);
            
            if (!isRequestOnlyStub) {
              mocks.push({ mock, filePath: fullPath });
            }
          }
        } catch (error) {
          // Skip invalid JSON files silently
        }
      }
    }
  }

  walkDir(scenarioPath);
  return mocks;
}

/**
 * Auto-detect mock data path by looking for common patterns.
 */
function detectMockDataPath(): string {
  const candidates = [
    './mock-data',
    './mocks',
    './test/mock-data',
    './tests/mock-data',
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Default to './mock-data' even if it doesn't exist yet
  return './mock-data';
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
