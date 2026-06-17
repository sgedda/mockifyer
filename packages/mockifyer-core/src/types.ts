/**
 * When Mockifyer applies mock lookup / recording to an outbound HTTP request.
 *
 * - **`always`** — Every request (default; historical behavior).
 * - **`client_id_header`** — Only when the outbound request includes a non-empty `X-Mockifyer-Client-Id` header (propagate from another service or set manually, e.g. Postman).
 * - **`off`** — Never; passthrough with no mock lookup and no recording.
 */
export type MockifyerActivationMode = 'always' | 'client_id_header' | 'off';

/**
 * Whether `setupMockifyerForReactNative` patches `fetch` at startup (activation gate, not per-request {@link MockifyerActivationMode}).
 *
 * - **`off`** — never activate; launch arguments do **not** override (use for production builds that ship Mockifyer code but must not run it).
 * - **`on`** — always activate when the helper is called.
 * - **`launch_client`** — activate only when the Maestro/native launch client lane id is non-empty (default key `mockifyerClientId`).
 *
 * Resolution: optional config **`runtimeMode`**, then env **`MOCKIFYER_MODE`**, else **`on`**. Set **`launch_client`** explicitly for E2E-only activation (`resolveMockifyerRuntimeMode` in `@sgedda/mockifyer-core`).
 */
export type MockifyerRuntimeMode = 'off' | 'on' | 'launch_client';

/**
 * Exclude **recording** only (mock replay unchanged) when an outbound URL matches the host hierarchy and optional pathname prefix.
 *
 * - **`host`**: **`example.com`** matches that host plus any subdomain (**`*.example.com`**). **`staging.example.com`** matches only **`staging.example.com`** and its subdomains, not **`api.example.com`**.
 * - **`pathPrefix`**: when set (e.g. **`/billing`**), exclusion applies only when the URL pathname equals that segment or begins with **`/billing/`**. Omit to exclude the entire host subtree from recording.
 *
 * Prefer {@link MockifyerConfig.recordingExclusions}; env **`MOCKIFYER_RECORDING_EXCLUSIONS`** / **`MOCKIFYER_RECORDING_EXCLUSION_HOSTS`** also apply when set ({@link parseRecordingExclusionsEnv}).
 */
export interface RecordingExclusion {
  /** Host name only (optionally pasted with `https://` — sanitized). No port segment. */
  host: string;
  /** Restrict exclusion to URLs under this pathname (leading `/` normalized). Omit = whole host subtree. */
  pathPrefix?: string;
}

export interface MockifyerConfig {
  mockDataPath: string;
  /**
   * Optional logical client lane identifier used for scenario isolation.
   *
   * Preferred: set `process.env.MOCKIFYER_CLIENT_ID` in dev/CI (env should win at startup).
   * Fallback: set this field directly when env injection is not convenient.
   * After `setupMockifyer`, you can call `setClientId(lane)` on the returned client to switch lanes at runtime
   * (mockifyer-fetch and mockifyer-axios). Startup resolution is unchanged if you never call it.
   */
  clientId?: string;
  /**
   * Optional per-install/per-device identifier for observability in shared stores (e.g. dashboard + Redis proxy).
   *
   * This is NOT used for scenario isolation; it is intended to help the dashboard answer
   * "which devices are currently using this lane?".
   *
   * Recommended: a UUID/ULID persisted on the client device.
   */
  deviceId?: string;
  /**
   * When true, read `clientId` from native launch arguments (optional peer `react-native-launch-arguments`).
   * Maestro: `launchApp.arguments.mockifyerClientId`. See {@link launchArgumentClientIdKey}.
   * If a non-empty value is read, it **takes precedence** over `MOCKIFYER_CLIENT_ID` and `config.clientId`.
   * If the flag is on but the argument is missing, resolution falls back to `resolveClientId` (env, `config.clientId`, then defaults).
   */
  useLaunchArgumentsClientId?: boolean;
  /**
   * Default: `mockifyerClientId` (same as `MOCKIFYER_LAUNCH_ARGUMENT_CLIENT_ID_KEY` export).
   */
  launchArgumentClientIdKey?: string;
  /** When true, records real API responses to mock data files. When false, uses existing mock data. */
  recordMode?: boolean;
  /** When true, throws an error if no mock data is found for a request. 
   * Note: This is automatically set to false when recordMode is true, as real API calls are needed for recording. */
  failOnMissingMock?: boolean;
  /**
   * When Mockifyer runs for each outbound HTTP call (mock replay, request limits, recording).
   *
   * | Mode | Behavior |
   * |------|----------|
   * | `always` (default) | All requests use Mockifyer (still subject to `excludedUrls` and internal bypasses). |
   * | `client_id_header` | Only if the request has a **non-empty** `X-Mockifyer-Client-Id` header, **or** (fetch + dashboard proxy only) a configured `proxy.baseUrl` and resolved `clientId` so the lane is sent on the proxy envelope. |
   * | `off` | Mockifyer does not intercept; plain HTTP. |
   *
   * Env **`MOCKIFYER_ACTIVATION_MODE`** overrides this when set to `always`, `client_id_header`, or `off`.
   */
  activationMode?: MockifyerActivationMode;
  useGlobalAxios?: boolean;
  /** When true and httpClientType is 'fetch', patches the global fetch function to use Mockifyer */
  useGlobalFetch?: boolean;
  /**
   * React Native / `setupMockifyerForReactNative`: when Mockifyer may patch `fetch` at startup.
   * Prefer **`MOCKIFYER_MODE`** env; this field overrides env when set.
   */
  runtimeMode?: MockifyerRuntimeMode;
  /** Optional title for the startup configuration log block (see `logMockifyerInitSummary`). */
  initLog?: { headline?: string };
  recordSameEndpoints?: boolean; // When false, don't record the same endpoint again
  /**
   * When true (and {@link MockifyerConfig.recordMode} is on), newly recorded mocks are saved with
   * {@link MockData.alwaysUseRealApi} so they stay on the live API until activated in the dashboard.
   * Env **`MOCKIFYER_RECORD_NEW_AS_PASSTHROUGH`** overrides this field when set.
   */
  recordNewMocksAsPassthrough?: boolean;
  /**
   * When true, existing passthrough recordings (`alwaysUseRealApi`) are updated in place on each
   * real API response instead of skipping save. Env **`MOCKIFYER_REFRESH_PASSTHROUGH_RECORDINGS`** overrides.
   */
  refreshPassthroughRecordings?: boolean;
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
  /**
   * When true (default), Mockifyer will NOT read date overrides from `date-config.json` on disk.
   *
   * This prevents accidental fixed-date overrides from local files when running with Redis/proxy.
   * Set to `false` only if you explicitly want the legacy file-based date config fallback.
   */
  disableDateConfigFileFallback?: boolean;
  /**
   * Default scenario name before file-based defaults (see **`getCurrentScenario`** precedence table in docs).
   * Same precedence as **`scenarios.default`**; **`defaultScenario`** wins when both are set.
   *
   * @example use when you prefer a flat config field rather than **`scenarios: { default: 'staging' }`**.
   */
  defaultScenario?: string;
  scenarios?: {
    default?: string;
    [key: string]: string | undefined;
  };
  /**
   * When true (or **`MOCKIFYER_STRICT_SCENARIO=true`**), and **`proxy.baseUrl`** is set, outbound traffic is not routed
   * through Mockifyer until **`clientId`** (lane) or **`proxy.scenario`** is explicitly set — passthrough plain HTTP otherwise.
   * When combined with {@link intendedProxyBaseUrl} (dashboard proxy intended but unavailable), local hybrid/filesystem
   * recording is blocked.
   * See **`isExplicitProxyScenarioContext`** / **`resolveStrictScenarioResolution`** in **`@sgedda/mockifyer-core`**.
   */
  strictScenarioResolution?: boolean;
  /**
   * Set when init intended dashboard/Redis proxy but the proxy is not active (e.g. health check failed).
   * With {@link strictScenarioResolution}, blocks local filesystem/hybrid/Metro mock saves.
   */
  intendedProxyBaseUrl?: string;
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
  /** URLs or URL patterns to fully bypass Mockifyer (no proxy, mock lookup, or recording).
   * Supports partial matches (e.g., 'login.microsoftonline.com' matches any URL containing that string).
   * Defaults include Mockifyer Metro internals (save/clear/sync/scenario-config) and Resend.
   * Set to empty array to disable all exclusions. */
  excludedUrls?: string[];
  /**
   * Host-based (optional path-prefix) rules that turn off **recording** only.
   *
   * Requests still replay from existing mocks where applicable and still hit the real API on miss; responses are simply not persisted when they match any rule ({@link shouldExcludeRecording}).
   *
   * Combined with **`MOCKIFYER_RECORDING_EXCLUSIONS`** (JSON) and **`MOCKIFYER_RECORDING_EXCLUSION_HOSTS`** when those env vars are set.
   *
   * @see {@link RecordingExclusion}
   */
  recordingExclusions?: RecordingExclusion[];
  /**
   * Optional HTTP proxy mode for environments that can't access the database provider directly (e.g. React Native + Redis).
   * When set, network requests can be routed through a proxy service (e.g. mockifyer-dashboard) which serves mocks and/or forwards upstream.
   */
  proxy?: {
    /** Base URL for the proxy service (e.g. `http://localhost:3002`) */
    baseUrl: string;
    /** Optional scenario override for the proxy lookup */
    scenario?: string;
    /**
     * Dashboard proxy: when **`true`**, JSON body to **`/api/proxy`** includes **`"record": true`** (persist on miss when the server allows).
     * When **`false`**, sends **`"record": false`** (never persist on that client).
     * When **omitted** (fetch SDK), the **`record`** field is **omitted** so the dashboard uses **per-scenario** `proxyConfig.recordOnMiss` (Redis default: record on miss).
     * Optional env **`MOCKIFYER_PROXY_RECORD_ON_MISS`** applies when this field is omitted and **`proxy.baseUrl`** is set (see **`parseProxyRecordOnMissEnv`**).
     */
    recordOnMiss?: boolean;
    /**
     * When false, proxy stores request-only stubs (`responsePending`) on cache miss instead of full responses.
     * Defaults to `false`. Env **`MOCKIFYER_RECORD_RESPONSES`** overrides when set.
     */
    recordResponses?: boolean;
    /**
     * When true (default when `baseUrl` is set), dashboard Redis proxy does not fall back to global
     * `active_scenario` if `clientId` is set but `client_scenario:{clientId}` is missing — upstream passthrough only.
     * Override via **`MOCKIFYER_STRICT_LANE_SCENARIO`** env (wins over this field).
     */
    strictLaneScenario?: boolean;
    /**
     * When the dashboard proxy records a response to Redis, also persist the same mock on this client
     * (filesystem, hybrid/expo scenario folder, or Metro `mockifyer-save` when using in-memory + strict proxy).
     * Env **`MOCKIFYER_PROXY_MIRROR_TO_CLIENT`** (`true`/`1`) enables when this field is omitted.
     */
    mirrorRecordedMocksToClient?: boolean;
  };
  /**
   * Best-effort traffic log to mockifyer-dashboard (`POST /api/network-events`).
   * Uses `proxy.baseUrl` when `dashboardBaseUrl` is omitted. Env **`MOCKIFYER_DASHBOARD_URL`** overrides.
   */
  networkLog?: {
    /** When false, disables SDK-side network log POSTs (dashboard proxy may still log). */
    enabled?: boolean;
    dashboardBaseUrl?: string;
    /** When true, include truncated request/response body previews in events. */
    captureBodies?: boolean;
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
    /** Additional provider-specific options (e.g., metroPort for hybrid provider, getClientId for live lane updates with redis) */
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
  /**
   * Which instant to offset from.
   *
   * - `now` (default): use the manipulated "current" date (`getCurrentDate`) when configured, else real time.
   * - `response`: **DEPRECATED.** Older recordings may still have this value persisted on disk/Redis.
   *   Since core 1.8.20, `base: 'response'` is treated identically to `base: 'now'` to avoid drift caused
   *   by stale recorded timestamps (e.g. the recorded value being "frozen" at an earlier fixed date).
   *   The original recorded value is NEVER used as the offset base anymore.
   */
  base?: 'now' | 'response';
  /** Milliseconds added to manipulated now (default 0). */
  offsetMs?: number;
  /** Optional day/hour/minute offsets (combined with offsetMs). */
  offsetDays?: number;
  offsetHours?: number;
  offsetMinutes?: number;
  /** How to encode the value. If omitted, inferred from the existing value (ISO string vs unix s/ms). */
  format?: 'iso' | 'unix-ms' | 'unix-s';
}

/**
 * When serving a mock, replace values at dot-paths under `response.data` without mutating the stored body.
 * Applied at replay before {@link MockResponseDateOverride}.
 */
export interface MockResponseFieldOverride {
  /** Dot-separated path from `response.data` root (e.g. `bookings.0.status`). */
  path: string;
  value: unknown;
}

export interface CopyArrayItemParams {
  /** Dot path to the array from `response.data` root (e.g. `bookings` or `data.bookings`). */
  arrayPath: string;
  /** Index of the existing item to clone. */
  fromIndex: number;
  /** Fields to merge onto the clone (keys are dot-paths relative to the item root). */
  itemOverrides?: Record<string, unknown>;
  /** Where to insert the clone. Default `append`. */
  insertAt?: 'append' | 'prepend' | number;
}

export interface MockData {
  request: StoredRequest;
  response: StoredResponse;
  timestamp: string;
  duration?: number; // Request duration in milliseconds
  scenario?: string;
  sessionId?: string; // Unique identifier for grouping related requests
  /** Unique id for this outbound hop (see request correlation headers). */
  requestId?: string;
  /** Id of the outbound request that triggered this hop. */
  parentRequestId?: string;
  /** Optional: when serving this mock, replace dates at the given paths relative to manipulated current date. */
  responseDateOverrides?: MockResponseDateOverride[];
  /** Optional: when serving this mock, replace field values at the given paths (overlay on stored body). */
  responseFieldOverrides?: MockResponseFieldOverride[];
  /**
   * When true, this recording is never served as a mock: the real API is always called when Mockifyer is enabled.
   * The file is still kept (e.g. for documentation or for updating while recording).
   * New recordings default this to **true** (store the body, keep calling live) until disabled in the dashboard; see **`MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API`**.
   */
  alwaysUseRealApi?: boolean;
  /**
   * When true, the next outbound request fetches upstream, updates the stored response body, clears this flag,
   * and returns the live response (with {@link responseDateOverrides} applied when configured).
   */
  refreshOnNextRequest?: boolean;
  /**
   * When true, every request fetches upstream, updates the stored response body, and returns the live response
   * (with {@link responseDateOverrides} applied when configured). The mock remains active (not passthrough).
   */
  alwaysRefreshFromLive?: boolean;
  /**
   * Request registered in the corpus without a captured response yet.
   * Implies live API until a response is stored and {@link alwaysUseRealApi} is cleared.
   */
  responsePending?: boolean;
}

// Environment variable names
export const ENV_VARS = {
  /** `off` \| `on` \| `launch_client` — RN startup gate; unset defaults to **`on`** via {@link MockifyerRuntimeMode}. */
  MOCK_RUNTIME_MODE: 'MOCKIFYER_MODE',
  MOCK_RECORD: 'MOCKIFYER_RECORD',
  MOCK_PATH: 'MOCKIFYER_PATH',
  MOCK_SCENARIO: 'MOCKIFYER_SCENARIO',
  MOCK_CLIENT_ID: 'MOCKIFYER_CLIENT_ID',
  MOCK_DATE: 'MOCKIFYER_DATE',
  MOCK_DATE_OFFSET: 'MOCKIFYER_DATE_OFFSET',
  MOCK_TIMEZONE: 'MOCKIFYER_TIMEZONE',
  MOCK_USE_SIMILAR_MATCH: 'MOCKIFYER_USE_SIMILAR_MATCH',
  MOCK_USE_SIMILAR_MATCH_CHECK_RESPONSE: 'MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE',
  /** `always` \| `client_id_header` \| `off` — see {@link MockifyerConfig.activationMode}. */
  MOCK_ACTIVATION_MODE: 'MOCKIFYER_ACTIVATION_MODE',
  /**
   * **`true|false`** — overrides {@link MockifyerConfig.strictScenarioResolution} when set.
   */
  MOCK_STRICT_SCENARIO: 'MOCKIFYER_STRICT_SCENARIO',
  /** Dashboard proxy: lane-only scenario (no global fallback) when `clientId` is set. */
  MOCK_STRICT_LANE_SCENARIO: 'MOCKIFYER_STRICT_LANE_SCENARIO',
  /**
   * **`true`** | **`false`** — sets `MockifyerConfig.proxy.recordOnMiss` when **`proxy.baseUrl`** is set and **`recordOnMiss`** is not already set in config.
   * Does not apply to React Native presets that always pass an explicit boolean for proxy recording.
   */
  MOCK_PROXY_RECORD_ON_MISS: 'MOCKIFYER_PROXY_RECORD_ON_MISS',
  /**
   * When not `false`, new recordings get **`alwaysUseRealApi: true`** (store body, keep using live API until disabled in the UI).
   */
  MOCK_RECORD_DEFAULT_ALWAYS_USE_REAL_API: 'MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API',
  /** New recordings default to passthrough until activated in the dashboard. */
  MOCK_RECORD_NEW_AS_PASSTHROUGH: 'MOCKIFYER_RECORD_NEW_AS_PASSTHROUGH',
  /** When `false`, proxy may persist request-only stubs (`responsePending`) instead of full responses. */
  MOCK_RECORD_RESPONSES: 'MOCKIFYER_RECORD_RESPONSES',
  /** Overwrite passthrough recordings on each live API response. */
  MOCK_REFRESH_PASSTHROUGH_RECORDINGS: 'MOCKIFYER_REFRESH_PASSTHROUGH_RECORDINGS',
  /** Dashboard origin for optional SDK network log POSTs (`/api/network-events`). */
  MOCK_DASHBOARD_URL: 'MOCKIFYER_DASHBOARD_URL',
  /** JSON array of `{ host, pathPrefix? }` — adds {@link RecordingExclusion} entries for dashboard proxy + merged into client exclusions when unset in config (see core `parseRecordingExclusionsEnv`). */
  MOCK_RECORDING_EXCLUSIONS: 'MOCKIFYER_RECORDING_EXCLUSIONS',
  /** Comma-separated hostnames-only exclusion list (apex + subdomain tree each). */
  MOCK_RECORDING_EXCLUSION_HOSTS: 'MOCKIFYER_RECORDING_EXCLUSION_HOSTS',
} as const;
