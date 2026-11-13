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

export interface DriftIssueWithHistory extends DriftIssue {
  /** ISO 8601 timestamp of first detection */
  firstSeen: string;
  /** ISO 8601 timestamp of most recent detection */
  lastSeen: string;
  /** Number of consecutive runs this issue appeared */
  occurrences: number;
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

export interface MockDriftReportWithHistory extends MockDriftReport {
  issues: DriftIssueWithHistory[];
  /** ISO 8601 timestamp until which this endpoint is snoozed */
  snoozedUntil?: string;
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
  /** Effective failOnWarnings setting (after merging config and CLI) */
  failOnWarnings: boolean;
}

export interface DriftHistoryReport extends DriftCheckReport {
  /** Schema version for future compatibility */
  reportVersion: 1;
  /** ISO 8601 timestamp of this check */
  timestamp: string;
  /** Git commit SHA at time of check (if available) */
  gitCommit?: string;
  /** Git branch name at time of check (if available) */
  gitBranch?: string;
  /** Per-mock reports with history */
  mockReports: MockDriftReportWithHistory[];
}

/**
 * Per-endpoint drift configuration.
 */
export interface EndpointDriftConfig {
  /** Severity level: critical means breaking fails CI, normal means warnings only */
  severity?: 'critical' | 'normal';
  /** JSON paths to ignore for this endpoint */
  ignorePaths?: string[];
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
  /** Per-endpoint drift configuration */
  endpointConfig?: Record<string, EndpointDriftConfig>;
  /** Number of history reports to retain (default: 30) */
  historyRetention?: number;
  /** Skip writing history reports */
  noHistory?: boolean;
}
