export interface MockifyerConfig {
  mockDataPath: string;
  recordMode?: boolean;
  autoMock?: boolean;
  useGlobalAxios?: boolean;
  recordSameEndpoints?: boolean; // When false, don't record the same endpoint again
  useSimilarMatch?: boolean; // When true, try to find similar path matches
  useSimilarMatchCheckResponse?: boolean; // When true, check response data when using similar match
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