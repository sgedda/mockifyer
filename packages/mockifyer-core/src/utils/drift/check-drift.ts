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
import {
  loadDriftHistory,
  writeDriftHistory,
  enhanceReportWithHistory,
} from './drift-management';

interface DriftConfig {
  scenario?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  ignorePaths?: string[];
  failOnWarnings?: boolean;
  allowUnsafeMethods?: boolean;
  concurrency?: number;
  timeoutMs?: number;
  delayMs?: number;
  endpointConfig?: Record<string, import('./drift-report').EndpointDriftConfig>;
  historyRetention?: number;
  noHistory?: boolean;
}

interface LoadedMock {
  mock: MockData;
  filePath: string;
}

/**
 * Check if a mock would actually be replayed by Mockifyer.
 * Returns false for request-only stubs, passthrough mocks, and incomplete recordings.
 */
function isActiveMock(mock: MockData): boolean {
  // Skip request-only stubs (responsePending or inboundParentStub)
  if (mock.responsePending === true || mock.inboundParentStub === true) {
    return false;
  }

  // Skip mocks set to always use real API (passthrough)
  if (mock.alwaysUseRealApi === true) {
    return false;
  }

  // Skip incomplete responses (status 0 with null data)
  if (mock.response.status === 0 && mock.response.data === null) {
    return false;
  }

  return true;
}

/**
 * Find all paths where the live response is an empty array while the mock had data.
 * This is common for time-sensitive data (e.g., "upcoming trips" that have passed).
 * Returns an array of JSON paths.
 */
function findEmptyLiveListPaths(
  expected: unknown,
  actual: unknown,
  path: string = ''
): string[] {
  const paths: string[] = [];

  // If expected is an array with items and actual is an empty array
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length > 0 && actual.length === 0) {
      paths.push(path || 'root');
    }
    return paths;
  }

  // Recursively check nested objects
  if (
    typeof expected === 'object' &&
    expected !== null &&
    !Array.isArray(expected) &&
    typeof actual === 'object' &&
    actual !== null &&
    !Array.isArray(actual)
  ) {
    for (const key of Object.keys(expected as Record<string, unknown>)) {
      const expectedValue = (expected as Record<string, unknown>)[key];
      const actualValue = (actual as Record<string, unknown>)[key];
      const fieldPath = path ? `${path}.${key}` : key;
      
      const nestedPaths = findEmptyLiveListPaths(expectedValue, actualValue, fieldPath);
      paths.push(...nestedPaths);
    }
  }

  return paths;
}

/**
 * Load drift config from file if it exists.
 * Looks for mockifyer.drift.json or a drift section in package.json.
 */
function loadDriftConfig(): DriftConfig {
  // Try mockifyer.drift.json
  if (fs.existsSync('mockifyer.drift.json')) {
    try {
      const content = fs.readFileSync('mockifyer.drift.json', 'utf-8');
      return JSON.parse(content);
    } catch {
      // Invalid JSON, ignore
    }
  }

  // Try package.json with mockifyer.drift section
  if (fs.existsSync('package.json')) {
    try {
      const content = fs.readFileSync('package.json', 'utf-8');
      const pkg = JSON.parse(content);
      if (pkg.mockifyer?.drift) {
        return pkg.mockifyer.drift;
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  return {};
}

/**
 * Merge config from file with CLI options (CLI options override config).
 */
function mergeConfig(
  fileConfig: DriftConfig,
  cliOptions: {
    scenario?: string;
    mockDataPath?: string;
    driftOptions?: DriftCheckOptions;
  }
): {
  scenario: string;
  mockDataPath: string;
  driftOptions: DriftCheckOptions;
} {
  const scenario = cliOptions.scenario ?? fileConfig.scenario ?? 'default';
  const mockDataPath = cliOptions.mockDataPath ?? detectMockDataPath();

  const driftOptions: DriftCheckOptions = {
    baseUrl: cliOptions.driftOptions?.baseUrl ?? fileConfig.baseUrl,
    headers: {
      ...(fileConfig.headers || {}),
      ...(cliOptions.driftOptions?.headers || {}),
    },
    ignorePaths: [
      ...(fileConfig.ignorePaths || []),
      ...(cliOptions.driftOptions?.ignorePaths || []),
    ],
    failOnWarnings:
      cliOptions.driftOptions?.failOnWarnings ?? fileConfig.failOnWarnings ?? false,
    allowUnsafeMethods:
      cliOptions.driftOptions?.allowUnsafeMethods ?? fileConfig.allowUnsafeMethods ?? false,
    concurrency: cliOptions.driftOptions?.concurrency ?? fileConfig.concurrency ?? 5,
    timeoutMs: cliOptions.driftOptions?.timeoutMs ?? fileConfig.timeoutMs ?? 10000,
    delayMs: cliOptions.driftOptions?.delayMs ?? fileConfig.delayMs ?? 100,
    endpointConfig: {
      ...(fileConfig.endpointConfig || {}),
      ...(cliOptions.driftOptions?.endpointConfig || {}),
    },
    historyRetention: cliOptions.driftOptions?.historyRetention ?? fileConfig.historyRetention ?? 30,
    noHistory: cliOptions.driftOptions?.noHistory ?? fileConfig.noHistory ?? false,
  };

  return { scenario, mockDataPath, driftOptions };
}

/**
 * Main entry point for drift checking.
 * Auto-detects mock data path if not provided.
 * Loads config from mockifyer.drift.json or package.json if available.
 */
export async function checkDrift(options: {
  scenario?: string;
  mockDataPath?: string;
  driftOptions?: DriftCheckOptions;
}): Promise<DriftCheckReport> {
  // Load config from file and merge with CLI options
  const fileConfig = loadDriftConfig();
  const { scenario, mockDataPath, driftOptions } = mergeConfig(fileConfig, options);

  const scenarioPath = path.join(mockDataPath, scenario);

  // Validate scenario path exists
  if (!fs.existsSync(scenarioPath)) {
    throw new Error(
      `Scenario path not found: ${scenarioPath}. ` +
        `Make sure mock data exists in '${mockDataPath}/${scenario}/'.`
    );
  }

  // Skip _scratch scenario
  if (scenario === '_scratch') {
    throw new Error(
      `Cannot check drift for '_scratch' scenario. ` +
        `_scratch is an ephemeral bucket for temporary traffic. ` +
        `Use a named scenario (e.g., 'default') instead.`
    );
  }

  // Load all mocks from the scenario
  const allMocks = loadMocksFromScenario(scenarioPath);

  if (allMocks.length === 0) {
    throw new Error(
      `No mocks found in scenario '${scenario}' at ${scenarioPath}. ` +
        `Record some mocks first using Mockifyer's record mode.`
    );
  }

  // Filter to only active mocks (ones that would actually be replayed)
  const activeMocks = allMocks.filter((m) => isActiveMock(m.mock));
  const inactiveCount = allMocks.length - activeMocks.length;

  if (activeMocks.length === 0) {
    throw new Error(
      `No active mocks found in scenario '${scenario}'. ` +
        `All ${allMocks.length} mocks are inactive (request-only stubs or set to always use real API). ` +
        `Record some complete mocks with replay enabled.`
    );
  }

  // Load previous history for tracking
  const previousHistory = loadDriftHistory(mockDataPath, scenario);

  // Check each active mock
  const mockReports: MockDriftReport[] = [];
  const concurrency = driftOptions.concurrency || 5;
  const delayMs = driftOptions.delayMs || 0;

  // Process in batches for concurrency control
  for (let i = 0; i < activeMocks.length; i += concurrency) {
    const batch = activeMocks.slice(i, i + concurrency);
    const batchPromises = batch.map((loadedMock) =>
      checkSingleMock(loadedMock, driftOptions, previousHistory)
    );

    const batchResults = await Promise.all(batchPromises);
    mockReports.push(...batchResults);

    // Rate limiting delay between batches
    if (delayMs > 0 && i + concurrency < activeMocks.length) {
      await sleep(delayMs);
    }
  }

  // Generate summary
  const driftedMocks = mockReports.filter((r) => r.hasDrift && !r.skipped && !r.notChecked).length;
  const breakingDriftCount = mockReports.filter(
    (r) => r.hasBreakingDrift && !r.skipped && !r.notChecked
  ).length;
  const warningOnlyCount = mockReports.filter(
    (r) => r.hasDrift && !r.hasBreakingDrift && !r.skipped && !r.notChecked
  ).length;
  const skippedCount = mockReports.filter((r) => r.skipped).length;
  const notCheckedCount = mockReports.filter((r) => r.notChecked).length;

  let summary: string;
  if (driftedMocks === 0 && skippedCount === 0 && notCheckedCount === 0) {
    summary = `✓ No drift detected in ${activeMocks.length} mocks`;
    if (inactiveCount > 0) {
      summary += ` (${inactiveCount} inactive mocks skipped)`;
    }
  } else if (driftedMocks === 0) {
    const checkedCount = activeMocks.length - skippedCount - notCheckedCount;
    summary = `✓ No drift detected in ${checkedCount} mocks`;
    const parts: string[] = [];
    if (notCheckedCount > 0) parts.push(`${notCheckedCount} not checked`);
    if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
    if (inactiveCount > 0) parts.push(`${inactiveCount} inactive`);
    if (parts.length > 0) {
      summary += ` (${parts.join(', ')})`;
    }
  } else {
    const parts: string[] = [];
    if (breakingDriftCount > 0) {
      parts.push(`${breakingDriftCount} breaking`);
    }
    if (warningOnlyCount > 0) {
      parts.push(`${warningOnlyCount} warning${warningOnlyCount === 1 ? '' : 's'}`);
    }
    const driftSuffix = parts.join(', ');
    summary = `✗ ${driftedMocks} of ${activeMocks.length} mocks drifted: ${driftSuffix}`;
    const suffixParts: string[] = [];
    if (notCheckedCount > 0) suffixParts.push(`${notCheckedCount} not checked`);
    if (skippedCount > 0) suffixParts.push(`${skippedCount} skipped`);
    if (inactiveCount > 0) suffixParts.push(`${inactiveCount} inactive`);
    if (suffixParts.length > 0) {
      summary += ` (${suffixParts.join(', ')})`;
    }
  }

  const report = {
    totalMocks: activeMocks.length,
    driftedMocks,
    breakingDriftCount,
    warningOnlyCount,
    skippedCount,
    notCheckedCount,
    mockReports,
    summary,
    failOnWarnings: driftOptions.failOnWarnings ?? false,
  };

  // Write history unless disabled
  if (!driftOptions.noHistory) {
    const historyReport = enhanceReportWithHistory(report, previousHistory);
    await writeDriftHistory(
      historyReport,
      mockDataPath,
      scenario,
      driftOptions.historyRetention || 30
    );
  }

  return report;
}

/**
 * Check a single mock against the live API.
 */
async function checkSingleMock(
  loadedMock: LoadedMock,
  options: DriftCheckOptions,
  previousHistory: any
): Promise<MockDriftReport> {
  const { mock, filePath } = loadedMock;
  const { method, url } = mock.request;

  // Check if endpoint is snoozed
  if (previousHistory) {
    const previousMock = previousHistory.mockReports.find(
      (r: any) => r.method === method && r.url === url
    );
    if (previousMock?.snoozedUntil) {
      const snoozeExpires = new Date(previousMock.snoozedUntil);
      if (snoozeExpires > new Date()) {
        return {
          method,
          url,
          mockFilePath: filePath,
          hasDrift: false,
          hasBreakingDrift: false,
          issues: [],
          skipped: true,
          skipReason: `Snoozed until ${previousMock.snoozedUntil}`,
        };
      }
    }
  }

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

  // Get endpoint-specific config
  const endpointKey = getEndpointKey(method, url);
  const endpointConfig = getEndpointConfig(endpointKey, options.endpointConfig || {});
  
  // Merge ignorePaths: global + endpoint-specific
  const mergedIgnorePaths = [
    ...(options.ignorePaths || []),
    ...(endpointConfig?.ignorePaths || []),
  ];

  const mergedOptions = {
    ...options,
    ignorePaths: mergedIgnorePaths,
  };

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

      // Build headers as a plain Record<string, string> before passing to fetch
      const headers: Record<string, string> = {
        ...filteredHeaders,
        ...(options.headers || {}),
      };

      // Include request body for POST/PUT/PATCH/DELETE
      let body: string | undefined;
      if (mock.request.data && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
        const isObject = typeof mock.request.data === 'object' && mock.request.data !== null;
        body = typeof mock.request.data === 'string'
          ? mock.request.data
          : JSON.stringify(mock.request.data);
        
        const hasContentType = Object.keys(headers).some(
          key => key.toLowerCase() === 'content-type'
        );
        if (isObject && !hasContentType) {
          headers['content-type'] = 'application/json';
        }
      }

      const response = await fetch(requestUrl, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Parse response body
      const actualBody = await parseResponseBody(response);

      // Compare with mock (always compare status and all fields)
      const issues = compareResponses(
        {
          expectedStatus: mock.response.status,
          actualStatus: response.status,
          expectedBody: mock.response.data,
          actualBody,
        },
        mergedOptions
      );

      // Check if there are empty live lists (mark as info, don't count as drift)
      const emptyListPaths = findEmptyLiveListPaths(mock.response.data, actualBody);
      const hasEmptyLists = emptyListPaths.length > 0;

      // If ALL issues are about empty arrays (no other drift), mark as notChecked
      if (issues.length === 0 && hasEmptyLists) {
        return {
          method,
          url,
          mockFilePath: filePath,
          hasDrift: false,
          hasBreakingDrift: false,
          issues: [],
          notChecked: true,
          notCheckedReason: `Empty live list at ${emptyListPaths.join(', ')}`,
        };
      }

      // Otherwise, report normal drift (empty lists don't hide other issues)
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
          if (mock.request && mock.response) {
            mocks.push({ mock, filePath: fullPath });
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

/**
 * Get endpoint key for config lookup (method + path).
 */
function getEndpointKey(method: string, url: string): string {
  try {
    const parsedUrl = new URL(url);
    return `${method} ${parsedUrl.pathname}`;
  } catch {
    return `${method} ${url}`;
  }
}

/**
 * Get endpoint-specific config, matching exact paths or patterns.
 */
function getEndpointConfig(
  endpointKey: string,
  endpointConfigs: Record<string, import('./drift-report').EndpointDriftConfig>
): import('./drift-report').EndpointDriftConfig | undefined {
  // Try exact match first
  if (endpointConfigs[endpointKey]) {
    return endpointConfigs[endpointKey];
  }

  // Try pattern matching
  for (const [pattern, config] of Object.entries(endpointConfigs)) {
    if (matchesPattern(endpointKey, pattern)) {
      return config;
    }
  }

  return undefined;
}

/**
 * Check if an endpoint key matches a pattern (supports wildcards).
 */
function matchesPattern(endpointKey: string, pattern: string): boolean {
  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\//g, '\\/');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(endpointKey);
}
