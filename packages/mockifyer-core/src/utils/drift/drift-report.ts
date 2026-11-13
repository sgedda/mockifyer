/**
 * Drift detection types for comparing expected mock responses with actual API responses.
 */

export type DriftSeverity = 'breaking' | 'warning';

export interface DriftIssue {
  /** JSON path to the drifted field (e.g., 'data.user.name' or 'items[0].id') */
  path: string;
  /** Type of drift detected */
  type: 'status_change' | 'missing_key' | 'extra_key' | 'type_change';
  /** Severity level */
  severity: DriftSeverity;
  /** Expected value type or status (never includes actual values) */
  expected?: string;
  /** Actual value type or status (never includes actual values) */
  actual?: string;
  /** Human-readable description */
  message: string;
}

export interface MockDriftReport {
  /** Request method */
  method: string;
  /** Request URL */
  url: string;
  /** Path to the mock file (when available) */
  mockFilePath?: string;
  /** Whether any drift was detected */
  hasDrift: boolean;
  /** Whether any breaking drift was detected */
  hasBreakingDrift: boolean;
  /** All drift issues found */
  issues: DriftIssue[];
  /** Whether the request was skipped (e.g., unreachable endpoint) */
  skipped?: boolean;
  /** Reason for skipping (e.g., 'Network error: ECONNREFUSED') */
  skipReason?: string;
  /** Whether the check was not performed (e.g., empty live list) */
  notChecked?: boolean;
  /** Reason for not checking (e.g., 'Empty live list') */
  notCheckedReason?: string;
}

export interface DriftCheckReport {
  /** Total number of mocks checked */
  totalMocks: number;
  /** Number of mocks with drift */
  driftedMocks: number;
  /** Number of mocks with breaking drift */
  breakingDriftCount: number;
  /** Number of mocks with warnings only */
  warningOnlyCount: number;
  /** Number of mocks skipped due to errors */
  skippedCount: number;
  /** Number of mocks not checked (e.g., empty live lists) */
  notCheckedCount: number;
  /** Per-mock drift reports */
  mockReports: MockDriftReport[];
  /** Overall summary message */
  summary: string;
}

/**
 * Options for configuring drift detection behavior.
 */
export interface DriftCheckOptions {
  /** Base URL for live API requests (overrides URL in mock) */
  baseUrl?: string;
  /** Additional headers to include in live requests (e.g., auth tokens) */
  headers?: Record<string, string>;
  /** JSON paths to ignore during comparison (e.g., ['timestamp', 'data.requestId']) */
  ignorePaths?: string[];
  /** Only check GET requests by default; set true to check all methods */
  allowUnsafeMethods?: boolean;
  /** Fail on warnings as well as breaking changes */
  failOnWarnings?: boolean;
  /** Maximum concurrent requests */
  concurrency?: number;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Delay between requests in milliseconds (rate limiting) */
  delayMs?: number;
}
