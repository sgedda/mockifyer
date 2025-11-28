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

export interface MockData {
  request: StoredRequest;
  response: StoredResponse;
  timestamp: string;
  scenario?: string;
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

