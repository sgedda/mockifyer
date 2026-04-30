export interface MockifyerConfig {
  mockDataPath: string;
  /** When true, records real API responses to mock data files. When false, uses existing mock data. */
  recordMode?: boolean;
  /** When true, throws an error if no mock data is found for a request. 
   * Note: This is automatically set to false when recordMode is true, as real API calls are needed for recording. */
  failOnMissingMock?: boolean;
  useGlobalAxios?: boolean;
  /** When true and httpClientType is 'fetch', patches the global fetch function to use Mockifyer */
  useGlobalFetch?: boolean;
  recordSameEndpoints?: boolean; // When false, don't record the same endpoint again
  useSimilarMatch?: boolean; // When true, try to find similar path matches
  useSimilarMatchCheckResponse?: boolean; // When true, check response data when using similar match
  similarMatchRequiredParams?: string[]; // Query parameters that must match for similar match to be used (e.g., ['season', 'league']). If not set, all query params are ignored by default.
  similarMatchIgnoreAllQueryParams?: boolean; // When true, explicitly ignore all query parameters when matching (matches on path and method only). This is the default behavior when similarMatchRequiredParams is not set, but this flag makes it explicit.
  dateManipulation?: {
    // Fixed date to use instead of current date
    fixedDate?: string | Date;
    // Offset in milliseconds from current date
    offset?: number;
    // Optional timezone for date operations
    timezone?: string;
  };
  scenarios?: {
    default?: string;
    [key: string]: string | undefined;
  };
  requestMatching?: {
    headers?: string[];
    ignoreQueryParams?: string[];
  };
  // HTTP client configuration
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
  axiosInstance?: any;
  /** Headers to anonymize when saving mock data (defaults to common API key headers). Set to empty array to disable. */
  anonymizeHeaders?: string[];
  /** Query parameters to anonymize when saving mock data (defaults to common API key params). Set to empty array to disable. */
  anonymizeQueryParams?: string[];
  /** URLs or URL patterns to exclude from recording/mocking. 
   * Supports partial matches (e.g., 'api.resend.com' will match any URL containing that string).
   * Defaults include Mockifyer Metro internals (save/clear/sync/scenario-config) and Resend.
   * Set to empty array to disable all exclusions. */
  excludedUrls?: string[];
  /**
   * Optional HTTP proxy mode for environments that can't access the database provider directly (e.g. React Native + Redis).
   * When set, network requests can be routed through a proxy service (e.g. mockifyer-dashboard) which serves mocks and/or forwards upstream.
   */
  proxy?: {
    /** Base URL for the proxy service (e.g. `http://localhost:3002`) */
    baseUrl: string;
    /** Optional scenario override for the proxy lookup */
    scenario?: string;
    /** If true, proxy will record responses on cache miss (if the proxy supports it) */
    recordOnMiss?: boolean;
  };
  /**
   * Optional storage backend for mocks. Defaults to filesystem under `mockDataPath`.
   * Use `redis` with `mockifyer-fetch` (Node) for a shared Redis-backed store; requires `ioredis`.
   * `mockifyer-axios` currently supports filesystem only for mock lookup.
   */
  databaseProvider?: {
    /** Provider: filesystem (default), sqlite, memory, expo-filesystem, hybrid, or redis (Node + fetch). */
    type?: 'filesystem' | 'sqlite' | 'memory' | 'expo-filesystem' | 'hybrid' | 'redis';
    /**
     * Path or connection URL: mock directory, SQLite file, or Redis URL (e.g. `redis://127.0.0.1:6379`).
     * For Redis, defaults to `MOCKIFYER_REDIS_URL` or `redis://127.0.0.1:6379`.
     */
    path?: string;
    /** Additional provider-specific options (e.g., metroPort for hybrid provider) */
    options?: Record<string, any>;
  };
  /** Test generation configuration */
  generateTests?: {
    /** Enable automatic test generation when mocks are saved */
    enabled?: boolean;
    /** Test framework to use: 'jest' (default), 'vitest', or 'mocha' */
    framework?: 'jest' | 'vitest' | 'mocha';
    /** Output path for generated tests (default: './tests/generated') */
    outputPath?: string;
    /** Test file naming pattern with placeholders: {endpoint}, {method}, {scenario} (default: '{endpoint}.test.ts') */
    testPattern?: string;
    /** Include setup code in generated tests (default: true) */
    includeSetup?: boolean;
    /** Group tests by: 'endpoint', 'scenario', or 'file' (default: 'file') */
    groupBy?: 'endpoint' | 'scenario' | 'file';
    /** If true, only generate one test per endpoint (method + pathname), ignoring query parameters (default: false) */
    uniqueTestsPerEndpoint?: boolean;
  };
  /** Logging configuration
   * - 'none': No logs (errors still logged)
   * - 'error': Only errors
   * - 'warn': Errors and warnings
   * - 'info': Errors, warnings, and info messages (default)
   * - 'debug': All logs including debug messages
   */
  logging?: 'none' | 'error' | 'warn' | 'info' | 'debug';
}

export interface StoredRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  data?: any;
  queryParams?: Record<string, string>;
}

export interface StoredResponse {
  status: number;
  data: any;
  headers: Record<string, string>;
}

/**
 * When serving a mock, rewrite these response paths to a date derived from the
 * manipulated current date (see `getCurrentDate` in mockifyer-core) plus optional offsets.
 */
export interface MockResponseDateOverride {
  /** Dot-separated path from `response.data` root. Use numeric segments for array indices (e.g. `items.0.expiresAt`). */
  path: string;
  /** Milliseconds added to manipulated now (default 0). */
  offsetMs?: number;
  /** Optional day/hour/minute offsets (combined with offsetMs). */
  offsetDays?: number;
  offsetHours?: number;
  offsetMinutes?: number;
  /** How to encode the value. If omitted, inferred from the existing value (ISO string vs unix s/ms). */
  format?: 'iso' | 'unix-ms' | 'unix-s';
}

export interface MockData {
  request: StoredRequest;
  response: StoredResponse;
  timestamp: string;
  duration?: number; // Request duration in milliseconds
  scenario?: string;
  sessionId?: string; // Unique identifier for grouping related requests
  /** Optional: when serving this mock, replace dates at the given paths relative to manipulated current date. */
  responseDateOverrides?: MockResponseDateOverride[];
}

// Environment variable names
export const ENV_VARS = {
  MOCK_ENABLED: 'MOCKIFYER_ENABLED',
  MOCK_RECORD: 'MOCKIFYER_RECORD',
  MOCK_PATH: 'MOCKIFYER_PATH',
  MOCK_SCENARIO: 'MOCKIFYER_SCENARIO',
  MOCK_DATE: 'MOCKIFYER_DATE',
  MOCK_DATE_OFFSET: 'MOCKIFYER_DATE_OFFSET',
  MOCK_TIMEZONE: 'MOCKIFYER_TIMEZONE',
  MOCK_USE_SIMILAR_MATCH: 'MOCKIFYER_USE_SIMILAR_MATCH',
  MOCK_USE_SIMILAR_MATCH_CHECK_RESPONSE: 'MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE'
} as const;

