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
    recordSameEndpoints?: boolean;
    useSimilarMatch?: boolean;
    useSimilarMatchCheckResponse?: boolean;
    similarMatchRequiredParams?: string[];
    similarMatchIgnoreAllQueryParams?: boolean;
    dateManipulation?: {
        fixedDate?: string | Date;
        offset?: number;
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
    baseUrl?: string;
    defaultHeaders?: Record<string, string>;
    axiosInstance?: any;
    /** Headers to anonymize when saving mock data (defaults to common API key headers). Set to empty array to disable. */
    anonymizeHeaders?: string[];
    /** Query parameters to anonymize when saving mock data (defaults to common API key params). Set to empty array to disable. */
    anonymizeQueryParams?: string[];
    /** URLs or URL patterns to exclude from recording/mocking.
     * Supports partial matches (e.g., 'api.resend.com' will match any URL containing that string).
     * Defaults to ['/mockifyer-save', '/mockifyer-clear', '/mockifyer-sync', 'api.resend.com'].
     * Set to empty array to disable all exclusions. */
    excludedUrls?: string[];
    /** Database provider configuration - NOT YET AVAILABLE FOR USE
     *
     * ⚠️ Database providers (SQLite, Memory, Expo) are not yet available for use.
     * Only the filesystem provider is currently supported.
     *
     * This configuration option exists for future use. Setting databaseProvider.type
     * to anything other than 'filesystem' (or undefined) will result in an error.
     *
     * Future support planned for:
     * - 'sqlite': SQLite database storage
     * - 'memory': In-memory storage for testing
     * - 'expo-filesystem': React Native/Expo filesystem storage
     */
    databaseProvider?: {
        /** Type of database provider: 'filesystem' (default), 'sqlite', 'memory' (in-memory), 'expo-filesystem' (for React Native/Expo), or 'hybrid' (device + project folder) */
        type?: 'filesystem' | 'sqlite' | 'memory' | 'expo-filesystem' | 'hybrid';
        /** Path for the provider (directory for filesystem/expo-filesystem, file path for SQLite, ignored for memory) */
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
    duration?: number;
    scenario?: string;
    sessionId?: string;
}
export declare const ENV_VARS: {
    readonly MOCK_ENABLED: "MOCKIFYER_ENABLED";
    readonly MOCK_RECORD: "MOCKIFYER_RECORD";
    readonly MOCK_PATH: "MOCKIFYER_PATH";
    readonly MOCK_SCENARIO: "MOCKIFYER_SCENARIO";
    readonly MOCK_DATE: "MOCKIFYER_DATE";
    readonly MOCK_DATE_OFFSET: "MOCKIFYER_DATE_OFFSET";
    readonly MOCK_TIMEZONE: "MOCKIFYER_TIMEZONE";
    readonly MOCK_USE_SIMILAR_MATCH: "MOCKIFYER_USE_SIMILAR_MATCH";
    readonly MOCK_USE_SIMILAR_MATCH_CHECK_RESPONSE: "MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE";
};
//# sourceMappingURL=types.d.ts.map