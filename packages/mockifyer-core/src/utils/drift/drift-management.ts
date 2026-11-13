/**
 * Drift management utilities: history tracking, accept/update, snooze, ignore rules.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { MockData } from '../../types';
import {
  DriftHistoryReport,
  MockDriftReportWithHistory,
  DriftIssueWithHistory,
  DriftCheckOptions,
  EndpointDriftConfig,
} from './drift-report';
import { checkDrift } from './check-drift';
import { omitProxyUpstreamRequestHeaders } from '../proxy-upstream-headers';

/**
 * Accept drift for one endpoint: re-fetch live and update mock file.
 */
export async function acceptDrift(options: {
  method: string;
  path: string;
  mockDataPath?: string;
  scenario?: string;
  driftOptions: DriftCheckOptions;
}): Promise<{ success: boolean; message: string; filePath?: string }> {
  const { method, path: urlPath } = options;
  
  const fileConfig = loadDriftConfigForManagement();
  const scenario = options.scenario ?? fileConfig.scenario ?? 'default';
  const mockDataPath = options.mockDataPath ?? detectMockDataPath();
  const driftOptions: DriftCheckOptions = {
    baseUrl: options.driftOptions?.baseUrl ?? fileConfig.baseUrl,
    headers: {
      ...(fileConfig.headers || {}),
      ...(options.driftOptions?.headers || {}),
    },
    ignorePaths: [
      ...(fileConfig.ignorePaths || []),
      ...(options.driftOptions?.ignorePaths || []),
    ],
    allowUnsafeMethods: options.driftOptions?.allowUnsafeMethods ?? fileConfig.allowUnsafeMethods ?? false,
    timeoutMs: options.driftOptions?.timeoutMs ?? fileConfig.timeoutMs ?? 10000,
  };

  // Find the mock file
  const mockFile = findMockFile(mockDataPath, scenario, method, urlPath);
  if (!mockFile) {
    return {
      success: false,
      message: `Mock file not found for ${method} ${urlPath}`,
    };
  }

  // Read the mock
  const mockData: MockData = JSON.parse(fs.readFileSync(mockFile, 'utf-8'));

  // Build request URL
  const requestUrl = driftOptions.baseUrl
    ? rewriteUrl(mockData.request.url, driftOptions.baseUrl)
    : mockData.request.url;

  // Skip non-GET requests unless explicitly allowed
  if (!driftOptions.allowUnsafeMethods && method.toUpperCase() !== 'GET') {
    return {
      success: false,
      message: `Cannot accept ${method} request without --allow-unsafe-methods flag`,
    };
  }

  // Make live request
  try {
    const timeoutMs = driftOptions.timeoutMs || 10000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const sanitizedMockHeaders = omitProxyUpstreamRequestHeaders(mockData.request.headers || {});
    const filteredHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(sanitizedMockHeaders)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== 'authorization' && !lowerKey.startsWith('x-mockifyer-')) {
        filteredHeaders[key] = value;
      }
    }

    const headers: Record<string, string> = {
      ...filteredHeaders,
      ...(driftOptions.headers || {}),
    };

    let body: string | undefined;
    if (mockData.request.data && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
      body = typeof mockData.request.data === 'string'
        ? mockData.request.data
        : JSON.stringify(mockData.request.data);

      const hasContentType = Object.keys(headers).some(
        key => key.toLowerCase() === 'content-type'
      );
      if (!hasContentType) {
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

    // Check for error responses
    if (!response.ok) {
      return {
        success: false,
        message: `Live API returned error status ${response.status}`,
      };
    }

    // Parse response body
    const contentType = response.headers.get('content-type') || '';
    let actualBody: unknown;
    if (contentType.includes('application/json')) {
      const text = await response.text();
      try {
        actualBody = JSON.parse(text);
      } catch {
        actualBody = text;
      }
    } else {
      actualBody = await response.text();
    }

    // Update only the response fields
    mockData.response.status = response.status;
    mockData.response.data = actualBody;

    // Write back to file
    fs.writeFileSync(mockFile, JSON.stringify(mockData, null, 2) + '\n');

    return {
      success: true,
      message: `Updated ${method} ${urlPath} (status ${response.status})`,
      filePath: mockFile,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to fetch ${method} ${urlPath}: ${error.message}`,
    };
  }
}

/**
 * Accept all warnings (non-breaking drift).
 */
export async function acceptAllWarnings(options: {
  mockDataPath?: string;
  scenario?: string;
  driftOptions: DriftCheckOptions;
}): Promise<{ accepted: number; failed: number; messages: string[] }> {
  const fileConfig = loadDriftConfigForManagement();
  const scenario = options.scenario ?? fileConfig.scenario ?? 'default';
  const mockDataPath = options.mockDataPath ?? detectMockDataPath();
  const driftOptions: DriftCheckOptions = {
    baseUrl: options.driftOptions?.baseUrl ?? fileConfig.baseUrl,
    headers: {
      ...(fileConfig.headers || {}),
      ...(options.driftOptions?.headers || {}),
    },
    ignorePaths: [
      ...(fileConfig.ignorePaths || []),
      ...(options.driftOptions?.ignorePaths || []),
    ],
    allowUnsafeMethods: options.driftOptions?.allowUnsafeMethods ?? fileConfig.allowUnsafeMethods ?? false,
    failOnWarnings: options.driftOptions?.failOnWarnings ?? fileConfig.failOnWarnings ?? false,
    concurrency: options.driftOptions?.concurrency ?? fileConfig.concurrency ?? 5,
    timeoutMs: options.driftOptions?.timeoutMs ?? fileConfig.timeoutMs ?? 10000,
    delayMs: options.driftOptions?.delayMs ?? fileConfig.delayMs ?? 100,
    endpointConfig: {
      ...(fileConfig.endpointConfig || {}),
      ...(options.driftOptions?.endpointConfig || {}),
    },
    historyRetention: options.driftOptions?.historyRetention ?? fileConfig.historyRetention ?? 30,
    noHistory: options.driftOptions?.noHistory ?? fileConfig.noHistory ?? false,
  };

  // Run drift check first
  const report = await checkDrift({
    scenario,
    mockDataPath,
    driftOptions,
  });

  // Filter to warnings only
  const warningsOnly = report.mockReports.filter(
    (r) => r.hasDrift && !r.hasBreakingDrift && !r.skipped && !r.notChecked
  );

  const messages: string[] = [];
  let accepted = 0;
  let failed = 0;

  for (const mockReport of warningsOnly) {
    const url = new URL(mockReport.url);
    const result = await acceptDrift({
      method: mockReport.method,
      path: url.pathname + url.search,
      mockDataPath,
      scenario,
      driftOptions,
    });

    if (result.success) {
      accepted++;
      messages.push(`✓ ${result.message}`);
    } else {
      failed++;
      messages.push(`✗ ${result.message}`);
    }
  }

  return { accepted, failed, messages };
}

/**
 * Snooze an endpoint for N days.
 */
export async function snoozeEndpoint(options: {
  method: string;
  path: string;
  days: number;
  mockDataPath?: string;
  scenario?: string;
}): Promise<{ success: boolean; message: string; expiresAt: string }> {
  const { method, path: urlPath, days } = options;
  
  const fileConfig = loadDriftConfigForManagement();
  const scenario = options.scenario ?? fileConfig.scenario ?? 'default';
  const mockDataPath = options.mockDataPath ?? detectMockDataPath();

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  // Load or initialize history
  const historyPath = path.join(mockDataPath, scenario, '.drift', 'latest.json');
  let history: DriftHistoryReport | null = null;

  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    } catch {
      // Ignore parse errors
    }
  }

  if (!history) {
    return {
      success: false,
      message: 'No drift history found. Run a drift check first.',
      expiresAt,
    };
  }

  // Find the endpoint in the history
  const mockReport = history.mockReports.find((r) => {
    const url = new URL(r.url);
    const reportPathWithQuery = url.pathname + url.search;
    const reportPathOnly = url.pathname;
    return r.method === method && (reportPathWithQuery === urlPath || reportPathOnly === urlPath);
  });

  if (!mockReport) {
    return {
      success: false,
      message: `Endpoint ${method} ${urlPath} not found in drift history`,
      expiresAt,
    };
  }

  // Update snooze
  mockReport.snoozedUntil = expiresAt;

  // Write back
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n');

  return {
    success: true,
    message: `Snoozed ${method} ${urlPath} until ${expiresAt}`,
    expiresAt,
  };
}

/**
 * Add an ignore path for a specific endpoint to config file.
 */
export async function addIgnoreField(options: {
  endpoint: string;
  jsonPath: string;
  configPath?: string;
}): Promise<{ success: boolean; message: string }> {
  const { endpoint, jsonPath, configPath = 'mockifyer.drift.json' } = options;

  let config: any = {};

  // Load existing config from target file only
  if (fs.existsSync(configPath)) {
    try {
      const fileContent = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config = { ...fileContent };
    } catch {
      // Invalid JSON, start with empty config
    }
  }

  // Initialize endpointConfig if needed
  if (!config.endpointConfig) {
    config.endpointConfig = {};
  }

  // Initialize endpoint config if needed
  if (!config.endpointConfig[endpoint]) {
    config.endpointConfig[endpoint] = {};
  }

  // Add ignorePath
  if (!config.endpointConfig[endpoint].ignorePaths) {
    config.endpointConfig[endpoint].ignorePaths = [];
  }

  if (!config.endpointConfig[endpoint].ignorePaths.includes(jsonPath)) {
    config.endpointConfig[endpoint].ignorePaths.push(jsonPath);
  }

  // Write back
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  return {
    success: true,
    message: `Added ignore path "${jsonPath}" for ${endpoint} to ${configPath}`,
  };
}

/**
 * Load drift history for a scenario.
 */
export function loadDriftHistory(
  mockDataPath: string,
  scenario: string
): DriftHistoryReport | null {
  const historyPath = path.join(mockDataPath, scenario, '.drift', 'latest.json');

  if (!fs.existsSync(historyPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Write drift history report and clean up old reports.
 */
export async function writeDriftHistory(
  report: DriftHistoryReport,
  mockDataPath: string,
  scenario: string,
  retention: number = 30
): Promise<void> {
  const driftDir = path.join(mockDataPath, scenario, '.drift');
  fs.mkdirSync(driftDir, { recursive: true });

  // Write timestamped report
  const timestamp = report.timestamp.replace(/:/g, '-').replace(/\..+$/, '');
  const timestampedPath = path.join(driftDir, `${timestamp}.json`);
  fs.writeFileSync(timestampedPath, JSON.stringify(report, null, 2) + '\n');

  // Write latest.json
  const latestPath = path.join(driftDir, 'latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(report, null, 2) + '\n');

  // Clean up old reports
  const files = fs.readdirSync(driftDir)
    .filter((f) => f.endsWith('.json') && f !== 'latest.json')
    .map((f) => ({
      name: f,
      path: path.join(driftDir, f),
      mtime: fs.statSync(path.join(driftDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);

  // Keep only the most recent N reports
  if (files.length > retention) {
    for (const file of files.slice(retention)) {
      fs.unlinkSync(file.path);
    }
  }
}

/**
 * Enhance a drift report with history tracking.
 */
export function enhanceReportWithHistory(
  currentReport: any,
  previousHistory: DriftHistoryReport | null
): DriftHistoryReport {
  const timestamp = new Date().toISOString();

  // Get git context
  let gitCommit: string | undefined;
  let gitBranch: string | undefined;
  try {
    if (fs.existsSync('.git')) {
      gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    }
  } catch {
    // Git not available or not a repo
  }

  // Enhance each mock report with history
  const mockReports: MockDriftReportWithHistory[] = currentReport.mockReports.map(
    (mockReport: any) => {
      const issues: DriftIssueWithHistory[] = mockReport.issues.map((issue: any) => {
        // Find matching issue in previous history
        const previousMock = previousHistory?.mockReports.find(
          (r) => r.method === mockReport.method && r.url === mockReport.url
        );
        const previousIssue = previousMock?.issues.find(
          (i) => i.path === issue.path && i.type === issue.type
        );

        if (previousIssue) {
          // Issue exists in history, update lastSeen and occurrences
          return {
            ...issue,
            firstSeen: previousIssue.firstSeen,
            lastSeen: timestamp,
            occurrences: previousIssue.occurrences + 1,
          };
        } else {
          // New issue
          return {
            ...issue,
            firstSeen: timestamp,
            lastSeen: timestamp,
            occurrences: 1,
          };
        }
      });

      // Preserve snooze state
      const previousMock = previousHistory?.mockReports.find(
        (r) => r.method === mockReport.method && r.url === mockReport.url
      );

      return {
        ...mockReport,
        issues,
        snoozedUntil: previousMock?.snoozedUntil,
      };
    }
  );

  return {
    ...currentReport,
    reportVersion: 1,
    timestamp,
    gitCommit,
    gitBranch,
    mockReports,
  };
}

/**
 * Find a mock file matching method and path.
 */
function findMockFile(
  mockDataPath: string,
  scenario: string,
  method: string,
  urlPath: string
): string | null {
  const scenarioPath = path.join(mockDataPath, scenario);

  function walkDir(dirPath: string): string | null {
    if (!fs.existsSync(dirPath)) {
      return null;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && entry.name !== '.drift') {
        const result = walkDir(fullPath);
        if (result) return result;
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const mock = JSON.parse(content) as MockData;

          if (mock.request && mock.response) {
            const mockUrl = new URL(mock.request.url);
            const mockPathWithQuery = mockUrl.pathname + mockUrl.search;
            const mockPathOnly = mockUrl.pathname;

            if (mock.request.method === method && (mockPathWithQuery === urlPath || mockPathOnly === urlPath)) {
              return fullPath;
            }
          }
        } catch {
          // Skip invalid files
        }
      }
    }

    return null;
  }

  return walkDir(scenarioPath);
}

/**
 * Rewrite a URL with a new base URL.
 */
function rewriteUrl(originalUrl: string, baseUrl: string): string {
  try {
    const original = new URL(originalUrl);
    const base = new URL(baseUrl);

    let basePath = base.pathname !== '/' ? base.pathname : '';
    if (basePath.endsWith('/')) {
      basePath = basePath.slice(0, -1);
    }
    return `${base.protocol}//${base.host}${basePath}${original.pathname}${original.search}`;
  } catch {
    return originalUrl;
  }
}

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
  endpointConfig?: Record<string, EndpointDriftConfig>;
  historyRetention?: number;
  noHistory?: boolean;
}

/**
 * Load drift config from file if it exists.
 */
function loadDriftConfigForManagement(): DriftConfig {
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
 * Auto-detect mock data path.
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

  return './mock-data';
}
