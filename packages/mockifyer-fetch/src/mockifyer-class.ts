/**
 * Core MockifyerClass - browser and Node compatible via dependency injection.
 * Only imports browser-safe utilities from @sgedda/mockifyer-core.
 */

import { NodeCapabilities } from './node-capabilities';

// Browser-safe imports from core
import {
  MockifyerConfig,
  MockData,
  StoredRequest,
  StoredResponse,
  HTTPClient,
  HTTPResponse,
  generateRequestKey as generateRequestKeyUtil,
  CachedMockData,
  DatabaseProvider,
  MemoryProvider,
  createProvider,
  logger,
  setLogLevel,
  TestGenerator,
  type TestGenerationOptions,
  prepareMockResponseBody,
  createServeTimeClock,
  createServeTimePoolResponseLoader,
  collectPoolRefIds,
  arePoolRefsEnabled,
  containsPoolRefs,
  isUsableNodeLikePoolFs,
  type PoolResponseItem,
  shouldBypassMockifyerForUrl,
  containsMockifyerSyncEndpointMarker,
  isMockifyerDashboardPlumbingApiUrl,
  resolveRecordingExclusions,
  shouldExcludeRecording,
  mockPassesThroughToRealApi,
  mockShouldServeStoredBody,
  mockShouldBeIncludedInRequestMatch,
  buildClientResponseFromLiveCapture,
  buildMockDataAfterLiveCapture,
  resolveShouldPersistLiveCapture,
  resolveMockRecordingSaveDecision,
  applyRecordingPassthroughFlag,
  resolveClientId,
  resolveExplicitClientIdOnly,
  resolveProxyStrictLaneScenario,
  resolveActivationMode,
  shouldApplyMockifyer,
  isScenarioLaunchFromNativeArguments,
  getCurrentScenario,
  unwrapAndMergeInlineTraceEnvelope,
  unwrapInlineTraceEnvelopeEmittingNetworkEvents,
  applyOutboundRequestCorrelation,
  resolveNetworkLogIncludeTraceOptionsAsync,
  emitMockifyerNetworkEvent,
  stripMockifyerTraceFromBody,
  resolveActiveMockifyerSessionId,
  setFlightRecorderRuntimeContext,
  getInlineTraceEnvelopeBusinessBody,
  recordInlineTraceHopFromExchange,
  outboundHeadersToRecord,
  isExplicitProxyScenarioContext,
  newRecordingUsesAlwaysUseRealApi,
  shouldBlockLocalMockRecording,
  resolveStrictScenarioResolution,
  type MockifyerActivationMode,
  resolveRecordResponses,
  resolveLocalRecordResponses,
  resolveLocalRecordResponsesForUrl,
  buildLocalRecordingMockData,
  adoptStoredOutboundRequestId,
  resolvePersistedHopIds,
  applyPersistedHopIds,
  type RequestCorrelationContext,
  DomainPathRulesSession,
  resolveInitialRuntimeEnabled,
  resolveRuntimeEnabledStorage,
  savePersistedRuntimeEnabled,
  type MockifyerRuntimeEnabledStorage,
  appendParamsToUrl,
  getMockFilePath,
  formatDateStr,
  getCurrentDate,
  isMockRecordingSidecarDir,
} from '@sgedda/mockifyer-core';

import { mirrorProxyRecordingToClient } from './core-proxy';

// Local imports
import { FetchHTTPClient } from './clients/fetch-client';

// Lazy-load Node.js built-ins (static literal requires, bundler-safe)
function getFs(): typeof import('fs') | null {
  // Only works in Node.js
  if (typeof process === 'undefined' || !process.versions?.node) {
    return null;
  }
  try {
    // Static require with literal path - bundlers can stub this
    return require('fs');
  } catch {
    return null;
  }
}

function getPath(): typeof import('path') | null {
  if (typeof process === 'undefined' || !process.versions?.node) {
    return null;
  }
  try {
    return require('path');
  } catch {
    return null;
  }
}

export class MockifyerClass {
  private config: MockifyerConfig;
  private httpClient: HTTPClient;
  private capabilities: NodeCapabilities;
  private processingRequests: Set<string> = new Set();
  private savingResponses: Set<string> = new Set();
  private databaseProvider?: DatabaseProvider;
  /** Resolves when async databaseProvider.initialize() completes (expo/hybrid). */
  private databaseProviderInitPromise: Promise<void> = Promise.resolve();
  private currentSessionId: string | null = null;
  private sessionStartTime: number = 0;
  private readonly SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private testGenerator?: TestGenerator;
  private readonly activationMode: MockifyerActivationMode;
  /**
   * Promoted pool responses for serve-time `$pool` resolve when Node `fs` is
   * unavailable (React Native / Metro stubs). Seeded via {@link warmPoolResponseCache}.
   */
  private readonly poolResponseCache = new Map<string, PoolResponseItem>();
  private readonly domainPathRules: DomainPathRulesSession;
  /** Runtime toggle: when false, all Mockifyer logic is bypassed (no dashboard, Redis, proxy, or mock lookup). */
  private runtimeEnabled: boolean;
  /** Optional storage for persisting enable/disable across restarts. */
  private readonly runtimeEnabledStorage?: MockifyerRuntimeEnabledStorage;
  /**
   * Runtime override for whether local/proxy recordings include response bodies.
   * `undefined` = follow env / defaults ({@link resolveLocalRecordResponses} / {@link resolveRecordResponses}).
   */
  private recordResponsesOverride: boolean | undefined = undefined;

  /** Session id for timeline hops — per-screen id from {@link setFlightRecorderRuntimeContext} when set. */
  private getRuntimeSessionId(): string {
    return resolveActiveMockifyerSessionId(() => {
      const now = Date.now();
      if (!this.currentSessionId || now - this.sessionStartTime > this.SESSION_TIMEOUT_MS) {
        this.currentSessionId = `session-${now}-${Math.random().toString(36).substring(2, 11)}`;
        this.sessionStartTime = now;
        setFlightRecorderRuntimeContext({ sessionId: this.currentSessionId });
      }
      return this.currentSessionId;
    });
  }

  private unwrapResponseInlineTrace(response: {
    data?: unknown;
    config?: unknown;
  }): void {
    const correlation = this.readRequestCorrelation(response.config);
    const parentRequestId = correlation?.requestId?.trim();
    if (!parentRequestId) {
      response.data = unwrapAndMergeInlineTraceEnvelope(response.data);
      return;
    }
    const scenario =
      this.config.proxy?.scenario?.trim() ||
      this.capabilities.getCurrentScenario(this.config.mockDataPath, this.config.clientId);
    response.data = unwrapInlineTraceEnvelopeEmittingNetworkEvents(response.data, {
      parentRequestId,
      config: this.config,
      scenario,
      clientId: this.config.clientId,
      sessionId: this.getRuntimeSessionId(),
      transport: this.usesDashboardProxy() ? 'proxy' : 'fetch',
    });
  }

  private async applyOutboundCorrelation(config: unknown): Promise<RequestCorrelationContext> {
    return applyOutboundRequestCorrelation(
      config as { headers?: unknown; url?: unknown; method?: unknown },
      await resolveNetworkLogIncludeTraceOptionsAsync(this.config)
    );
  }

  /**
   * Full outbound URL including `params` — hop logs / Atlas curl / include-trace
   * must not drop the query string (fetch splits search into `config.params`).
   */
  private resolveLoggedRequestUrl(
    config?: { url?: string; params?: Record<string, unknown> } | null,
    fallbackUrl?: string,
  ): string {
    const raw = (fallbackUrl || config?.url || '').trim();
    if (!raw) return '';
    return appendParamsToUrl(raw, config?.params);
  }

  /** Best-effort dashboard network log. */
  private logNetworkEvent(
    partial: Parameters<typeof emitMockifyerNetworkEvent>[0]['event'] & {
      transport?: 'fetch' | 'proxy';
      /** Raw bodies for inline-trace / network-log previews (stripped before emit). */
      requestBody?: unknown;
      responseBody?: unknown;
    },
    correlation?: RequestCorrelationContext,
    /** Final outbound header bag (after auth interceptors). */
    requestHeadersSource?: unknown
  ): void {
    const scenario =
      this.config.proxy?.scenario?.trim() ||
      this.capabilities.getCurrentScenario(this.config.mockDataPath, this.config.clientId);

    const { requestBody, responseBody, ...eventPartial } = partial;
    const businessResponseBody = getInlineTraceEnvelopeBusinessBody(responseBody);
    const requestHeaders =
      eventPartial.requestHeaders ?? outboundHeadersToRecord(requestHeadersSource);

    if (!this.config.proxy?.baseUrl) {
      recordInlineTraceHopFromExchange({
        method: eventPartial.method,
        url: eventPartial.url,
        status: eventPartial.status,
        source: eventPartial.source,
        transport: eventPartial.transport ?? 'fetch',
        requestId: correlation?.requestId ?? eventPartial.requestId ?? null,
        parentRequestId: correlation?.parentRequestId ?? eventPartial.parentRequestId ?? null,
        durationMs: eventPartial.durationMs,
        clientId: this.config.clientId ?? eventPartial.clientId ?? null,
        errorMessage: eventPartial.errorMessage,
        requestHeaders,
        requestBody,
        responseBody,
      });
    }

    emitMockifyerNetworkEvent({
      config: this.config,
      scenario,
      clientId: this.config.clientId,
      sessionId: this.getRuntimeSessionId(),
      requestBody,
      responseBody: businessResponseBody,
      event: {
        ...eventPartial,
        transport: eventPartial.transport ?? 'fetch',
        requestId: correlation?.requestId ?? eventPartial.requestId,
        parentRequestId: correlation?.parentRequestId ?? eventPartial.parentRequestId,
        requestHeaders,
        requestBodyPreview: eventPartial.requestBodyPreview,
        responseBodyPreview: eventPartial.responseBodyPreview,
      },
    });
  }

  private stashRequestCorrelation(config: unknown, correlation: RequestCorrelationContext): void {
    (config as { __mockifyer_requestId?: string; __mockifyer_parentRequestId?: string }).__mockifyer_requestId =
      correlation.requestId;
    (config as { __mockifyer_parentRequestId?: string }).__mockifyer_parentRequestId =
      correlation.parentRequestId;
  }

  private bindStoredHopId(
    config: unknown,
    mockData: { requestId?: string } | undefined,
    fallback?: RequestCorrelationContext
  ): RequestCorrelationContext | undefined {
    const adopted = adoptStoredOutboundRequestId(
      config as { headers?: unknown },
      mockData?.requestId
    );
    if (adopted) {
      this.stashRequestCorrelation(config, adopted);
      return adopted;
    }
    return fallback;
  }

  private readRequestCorrelation(config: unknown): RequestCorrelationContext | undefined {
    const requestId = (config as { __mockifyer_requestId?: string }).__mockifyer_requestId;
    if (!requestId) return undefined;
    const parentRequestId = (config as { __mockifyer_parentRequestId?: string }).__mockifyer_parentRequestId;
    return parentRequestId ? { requestId, parentRequestId } : { requestId };
  }

  /** Attach dashboard lookup id onto thrown fetch/client errors. */
  private throwWithMockifyerRequestId(error: unknown): never {
    const err = error as { config?: unknown; response?: { headers?: unknown }; mockifyerRequestId?: string };
    const hopRequestId = (err?.config as { __mockifyer_requestId?: string } | undefined)?.__mockifyer_requestId;
    if (hopRequestId) {
      err.mockifyerRequestId = hopRequestId;
    }
    throw error;
  }

  /**
   * Serve stored mock body with optional `$pool` resolution from the local fixture pool.
   * Always passes `loadPoolResponse` — including React Native where Node `fs`/`path` are
   * missing or Metro-stubbed — so `$pool` refs resolve via disk and/or {@link poolResponseCache}.
   */
  private prepareStoredResponseBody(mockData: MockData, filename?: string, scenarioPath?: string): unknown {
    const fs = getFs();
    const path = getPath();
    const joinPath =
      path && typeof path.join === 'function' ? path.join.bind(path) : null;
    return prepareMockResponseBody(mockData, createServeTimeClock(this.config), {
      loadPoolResponse: createServeTimePoolResponseLoader({
        mockDataPath: this.config.mockDataPath,
        nodeFs: isUsableNodeLikePoolFs(fs) ? fs : null,
        joinPath,
        cache: this.poolResponseCache,
      }),
      filename,
      scenarioPath,
    });
  }

  /**
   * Ensure `$pool` fixtures are available in {@link poolResponseCache} when Node fs
   * cannot load them (React Native). Tries database provider, then Metro.
   */
  private async warmPoolResponseCache(mockData: MockData): Promise<void> {
    if (!arePoolRefsEnabled() || !containsPoolRefs(mockData.response?.data)) {
      return;
    }
    const fs = getFs();
    if (isUsableNodeLikePoolFs(fs)) {
      return;
    }

    const ids = collectPoolRefIds(mockData.response.data);
    for (const id of ids) {
      if (this.poolResponseCache.has(id)) {
        continue;
      }
      const fromProvider = await this.loadPoolResponseFromProvider(id);
      if (fromProvider) {
        this.poolResponseCache.set(id, fromProvider);
        continue;
      }
      const fromMetro = await this.loadPoolResponseFromMetro(id);
      if (fromMetro) {
        this.poolResponseCache.set(id, fromMetro);
      }
    }
  }

  private async loadPoolResponseFromProvider(
    id: string
  ): Promise<PoolResponseItem | undefined> {
    const provider = this.databaseProvider as
      | { loadPoolResponseItem?: (poolId: string) => Promise<PoolResponseItem | undefined> | PoolResponseItem | undefined }
      | undefined;
    if (!provider || typeof provider.loadPoolResponseItem !== 'function') {
      return undefined;
    }
    try {
      return (await provider.loadPoolResponseItem(id)) ?? undefined;
    } catch (error) {
      logger.warn(`[Mockifyer-Fetch] Failed to load pool response "${id}" from provider:`, error);
      return undefined;
    }
  }

  private async loadPoolResponseFromMetro(
    id: string
  ): Promise<PoolResponseItem | undefined> {
    const metroPort = this.config.databaseProvider?.options?.metroPort ?? 8081;
    const originalFetch =
      (global as { __mockifyer_original_fetch?: typeof fetch }).__mockifyer_original_fetch ||
      (typeof fetch !== 'undefined' ? fetch : undefined);
    if (!originalFetch) {
      return undefined;
    }
    try {
      const url = `http://localhost:${metroPort}/mockifyer-pool-response?id=${encodeURIComponent(id)}`;
      const response = await originalFetch(url);
      if (!response.ok) {
        return undefined;
      }
      const payload = (await response.json()) as {
        success?: boolean;
        item?: PoolResponseItem;
      };
      if (payload.success && payload.item?.responseItemId && payload.item.response) {
        return payload.item;
      }
      return undefined;
    } catch (error) {
      logger.warn(`[Mockifyer-Fetch] Failed to load pool response "${id}" from Metro:`, error);
      return undefined;
    }
  }

  constructor(config: MockifyerConfig, capabilities?: NodeCapabilities) {
    // Import Node capabilities (static require, bundler handles via package.json exports)
    if (!capabilities) {
      // Static require with literal path - package.json browser field maps to .browser.ts
      if (typeof require !== 'undefined') {
        try {
          const nodeModule = require('./node-capabilities.node');
          this.capabilities = nodeModule.nodeCapabilities;
        } catch (error) {
          throw new Error(
            '[Mockifyer] Failed to load node capabilities. ' +
            'In browser builds, pass capabilities explicitly or use the browser entry point. ' +
            `Error: ${error}`
          );
        }
      } else {
        throw new Error(
          '[Mockifyer] No capabilities provided and require() not available. ' +
          'In browser builds, pass capabilities explicitly or use the browser entry point.'
        );
      }
    } else {
      this.capabilities = capabilities;
    }

    // Validate database provider - filesystem, expo-filesystem, hybrid, and memory are supported
    if (config.databaseProvider && config.databaseProvider.type) {
      const supportedTypes = ['filesystem', 'expo-filesystem', 'hybrid', 'memory', 'redis', 'sqlite'];
      if (!supportedTypes.includes(config.databaseProvider.type)) {
        throw new Error(
          `Database provider type '${config.databaseProvider.type}' is not yet available for use. ` +
          `Supported types: ${supportedTypes.join(', ')}. ` +
          `Please use one of the supported provider types.`
        );
      }
    }
    
    // Validate and normalize conflicting settings
    if (config.recordMode && config.failOnMissingMock) {
      logger.warn(
        '[Mockifyer] Warning: recordMode is true but failOnMissingMock is also set to true. ' +
        'failOnMissingMock is ignored in record mode (real API calls are made to record responses). ' +
        'Setting failOnMissingMock to false.'
      );
      config.failOnMissingMock = false;
    }
    
    // Validate conflicting similar match settings
    if (config.similarMatchIgnoreAllQueryParams && 
        config.similarMatchRequiredParams && 
        config.similarMatchRequiredParams.length > 0) {
      logger.warn(
        '[Mockifyer-Fetch] Warning: Both similarMatchIgnoreAllQueryParams and similarMatchRequiredParams are set. ' +
        'similarMatchIgnoreAllQueryParams takes precedence and all query parameters will be ignored. ' +
        'similarMatchRequiredParams will be ignored.'
      );
      // Clear similarMatchRequiredParams to avoid confusion
      config.similarMatchRequiredParams = undefined;
    }
    
    // Auto-enable useSimilarMatch if similarMatchRequiredParams is set (and not ignored)
    if (config.similarMatchRequiredParams && config.similarMatchRequiredParams.length > 0) {
      if (config.useSimilarMatch === undefined || config.useSimilarMatch === false) {
        config.useSimilarMatch = true;
      }
    }
    
    // Auto-enable useSimilarMatch if similarMatchIgnoreAllQueryParams is set
    if (config.similarMatchIgnoreAllQueryParams) {
      if (config.useSimilarMatch === undefined || config.useSimilarMatch === false) {
        config.useSimilarMatch = true;
      }
    }
    
    // Store config BEFORE any modifications
    this.config = { ...config }; // Create a copy to avoid mutations

    // Resolve client ID
    // Strict proxy: no auto lane until explicit clientId / setClientId (devtools show real URLs).
    if (
      resolveStrictScenarioResolution(this.config) &&
      Boolean(this.config.proxy?.baseUrl?.trim())
    ) {
      this.config.clientId = resolveExplicitClientIdOnly(this.config);
    } else {
      this.config.clientId = resolveClientId(this.config);
    }
    this.activationMode = resolveActivationMode(this.config);
    this.domainPathRules = new DomainPathRulesSession({
      config: this.config,
      getRecordMode: () => this.config.recordMode === true,
    });
    
    this.runtimeEnabledStorage = resolveRuntimeEnabledStorage(config.persistRuntimeEnabled);
    if (config.persistRuntimeEnabled === true && !this.runtimeEnabledStorage) {
      logger.warn(
        '[Mockifyer-Fetch] persistRuntimeEnabled: true but no storage found. ' +
          'Install @react-native-async-storage/async-storage (RN) or use a custom { getItem, setItem }.'
      );
    }
    this.runtimeEnabled = resolveInitialRuntimeEnabled({
      initialRuntimeEnabled: config.initialRuntimeEnabled,
      startDisabled: config.startDisabled,
      runtimeMode: config.runtimeMode,
      launchScenarioPresent: isScenarioLaunchFromNativeArguments(),
    });
    
    if (!this.runtimeEnabled) {
      const reason =
        typeof config.initialRuntimeEnabled === 'boolean'
          ? 'persisted / initialRuntimeEnabled: false'
          : config.runtimeMode === 'manual'
            ? 'runtimeMode: "manual"'
            : 'startDisabled: true';
      logger.info(
        `[Mockifyer-Fetch] Starting with Mockifyer DISABLED (${reason}). Call enableMockifyer() to activate.`
      );
    }

    if (this.config.proxy?.baseUrl && this.config.proxy.mirrorRecordedMocksToClient === undefined) {
      const raw =
        typeof process !== 'undefined'
          ? String(process.env?.MOCKIFYER_PROXY_MIRROR_TO_CLIENT || '').trim().toLowerCase()
          : '';
      if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') {
        this.config.proxy = { ...this.config.proxy, mirrorRecordedMocksToClient: true };
      }
    }

    // Initialize test generator if test generation is enabled
    if (config.generateTests?.enabled) {
      this.testGenerator = new TestGenerator();
    }
    
    // Initialize database provider if specified
    if (config.databaseProvider && config.databaseProvider.type) {
      const providerConfig = {
        ...config.databaseProvider,
        options: {
          ...config.databaseProvider.options,
          mockDataPath:
            config.databaseProvider.options?.mockDataPath ?? config.mockDataPath,
          clientId: this.config.clientId,
          getClientId: () => this.config.clientId,
        },
      };
      this.databaseProvider = createProvider(config.databaseProvider.type, providerConfig);
      const initResult = this.databaseProvider.initialize();
      // Handle async initialization (expo-filesystem / hybrid providers)
      if (initResult instanceof Promise) {
        this.databaseProviderInitPromise = initResult.catch((error) => {
          logger.error('[Mockifyer-Fetch] Error initializing database provider:', error);
        });
      }
    } else {
      // Fallback to Node.js filesystem
      this.ensureMockDataDirectory();
    }
    
    // Create fetch HTTP client
    this.httpClient = new FetchHTTPClient({
      baseUrl: config.baseUrl,
      defaultHeaders: config.defaultHeaders,
      proxy: config.proxy,
      clientId: this.config.clientId,
      getClientId: () => this.config.clientId,
      getStrictLaneScenario: () => resolveProxyStrictLaneScenario(this.config),
      getUpstreamTlsInsecure: () => false, // Browser-safe: no TLS insecure
      getExplicitProxyScenarioContext: () => isExplicitProxyScenarioContext(this.config),
      deviceId: (this.config as any).deviceId,
    });
    
    if(!config.recordSameEndpoints) {
      this.loadMockData();
    }
    // Always set up mock response interceptor (to use existing mocks)
    this.setupMockResponses();
    
    // Set up response interceptor to save responses when recordMode is enabled
    this.setupResponseInterceptor();

    logger.info('[Mockifyer] Initialized');
  }

  private ensureMockDataDirectory(): void {
    const fs = getFs();
    // Only use fs if available (Node.js environment) and no database provider is set
    if (!fs || this.databaseProvider) {
      return;
    }
    if (!fs.existsSync(this.config.mockDataPath)) {
      fs.mkdirSync(this.config.mockDataPath, { recursive: true });
    }
  }

  private generateRequestKey(request: StoredRequest): string {
    return generateRequestKeyUtil(request);
  }

  /** When set, mock resolution happens on the dashboard `/api/proxy` (Redis/disk), not local `mock-data`. */
  private usesDashboardProxy(): boolean {
    const baseUrl = this.config.proxy?.baseUrl;
    return typeof baseUrl === 'string' && baseUrl.trim().length > 0;
  }

  private async findBestMatchingMock(
    request: StoredRequest,
    options?: { includePassthroughMocks?: boolean }
  ): Promise<CachedMockData | undefined> {
    // CRITICAL: Never try to match sync endpoint requests - they should never be mocked
    const requestUrl = request?.url || '';
    if (containsMockifyerSyncEndpointMarker(requestUrl)) {
      return undefined;
    }
    
    const requestKey = this.generateRequestKey(request);
    
    // CRITICAL: Also check requestKey for sync endpoint URLs (defense in depth)
    if (containsMockifyerSyncEndpointMarker(requestKey)) {
      return undefined;
    }
    
    // Use database provider if available, otherwise fallback to filesystem
    if (this.databaseProvider) {
      return await this.findBestMatchingMockFromProvider(request, options);
    }
    // Fallback to Node.js filesystem
    return this.findBestMatchingMockFromFiles(request, options);
  }

  private async findBestMatchingMockFromProvider(
    request: StoredRequest,
    options?: { includePassthroughMocks?: boolean }
  ): Promise<CachedMockData | undefined> {
    if (!this.databaseProvider) {
      return undefined;
    }

    // CRITICAL: Never try to match sync endpoint requests - they should never be mocked
    const requestUrl = request?.url || '';
    if (containsMockifyerSyncEndpointMarker(requestUrl)) {
      return undefined;
    }

    const requestKey = this.generateRequestKey(request);
    
    // CRITICAL: Also check requestKey for sync endpoint URLs (defense in depth)
    if (containsMockifyerSyncEndpointMarker(requestKey)) {
      return undefined;
    }
    
    // Try exact match first
    const exactMatch = await this.databaseProvider.findExactMatch(request, requestKey, options);
    if (exactMatch) {
      return exactMatch;
    }

    // Try similar match if enabled
    if (this.config.useSimilarMatch) {
      const similarMatches = await this.databaseProvider.findAllForSimilarMatch(request);
      if (similarMatches && similarMatches.length > 0) {
        // Return first similar match
        return similarMatches[0];
      }
    }

    return undefined;
  }

  private getAllJsonFiles(dir: string): string[] {
    const fs = getFs();
    const path = getPath();
    if (!fs || !path || !fs.existsSync(dir)) return [];
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (isMockRecordingSidecarDir(entry.name)) {
          continue;
        }
        results.push(...this.getAllJsonFiles(fullPath));
      } else if (entry.name.endsWith('.json')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  private findBestMatchingMockFromFiles(
    request: StoredRequest,
    options?: { includePassthroughMocks?: boolean }
  ): CachedMockData | undefined {
    const fs = getFs();
    const path = getPath();
    const includePassthroughMocks = options?.includePassthroughMocks === true;
    // Only use fs if available (Node.js environment)
    // This method should never be called when using a database provider
    if (!fs || !path) {
      return undefined;
    }
    const resolvedMockDataPath = path.resolve(this.config.mockDataPath);
    
    if (!fs.existsSync(resolvedMockDataPath)) {
      console.warn('[Mockifyer-Fetch] ⚠️ Mock data path does not exist:', resolvedMockDataPath);
      return undefined;
    }

    const currentScenario = this.capabilities.getCurrentScenario(resolvedMockDataPath, this.config.clientId);
    const scenarioPath = this.capabilities.getScenarioFolderPath(resolvedMockDataPath, currentScenario);
    
    if (!fs.existsSync(scenarioPath)) {
      logger.warn('[Mockifyer-Fetch] ⚠️ Scenario path does not exist:', scenarioPath);
      return undefined;
    }

    const files = this.getAllJsonFiles(scenarioPath);

    const requestKey = this.generateRequestKey(request);
    let exactMatch: CachedMockData | undefined;
    let similarMatch: CachedMockData | undefined;
    
    for (const filePath of files) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const mockData: MockData = JSON.parse(fileContent);
        
        if (!mockData || !mockData.request || typeof mockData.request !== 'object') {
          continue;
        }
        
        const mockKey = this.generateRequestKey(mockData.request);
        const filename = path.relative(scenarioPath, filePath);
        
        if (mockKey === requestKey) {
          if (
            mockShouldBeIncludedInRequestMatch(mockData, {
              includePassthroughMocks,
              filename,
              scenarioPath,
            })
          ) {
            exactMatch = { mockData, filename, filePath };
            break;
          }
          continue;
        }
        
        if (!exactMatch && this.config.useSimilarMatch && !similarMatch) {
          // Check if it's a GraphQL request - skip similar matching for GraphQL
          const isGraphQL = ['POST', 'PUT', 'PATCH'].includes((request.method || 'GET').toUpperCase()) &&
                           request.data &&
                           (() => {
                             try {
                               let bodyData = request.data;
                               if (typeof request.data === 'string') {
                                 bodyData = JSON.parse(request.data);
                               }
                               return typeof bodyData === 'object' && bodyData !== null && typeof bodyData.query === 'string';
                             } catch {
                               return false;
                             }
                           })();
          
          if (!isGraphQL) {
            try {
              const requestUrl = new URL(request.url);
              const mockUrl = new URL(mockData.request.url);
              
              // Check if pathnames match (exact or pattern-based)
              const requestPathname = requestUrl.pathname;
              const mockPathname = mockUrl.pathname;
              const methodMatch = (mockData.request.method || 'GET').toUpperCase() === (request.method || 'GET').toUpperCase();
              
              // Check for exact pathname match
              const exactPathnameMatch = mockPathname === requestPathname;
              
              // Check for pattern-based match
              let patternMatch = false;
              if (this.config.similarMatchIgnoreAllQueryParams && !exactPathnameMatch && methodMatch) {
                const requestSegments = requestPathname.split('/').filter(s => s);
                const mockSegments = mockPathname.split('/').filter(s => s);
                
                if (requestSegments.length === mockSegments.length && requestSegments.length > 0) {
                  const requestBase = requestSegments.slice(0, -1);
                  const mockBase = mockSegments.slice(0, -1);
                  patternMatch = requestBase.join('/') === mockBase.join('/');
                }
              }
              
              const pathnameMatch = exactPathnameMatch || patternMatch;
              
              if (pathnameMatch && methodMatch) {
                
                // If ignoreAllQueryParams is set, skip query param checking entirely
                if (this.config.similarMatchIgnoreAllQueryParams) {
                  // Ignore all query params, match on path and method only
                } else if (this.config.similarMatchRequiredParams && this.config.similarMatchRequiredParams.length > 0) {
                  // Check if required parameters match (if configured)
                  const requestParams = request.queryParams || {};
                  const mockParams = mockData.request.queryParams || {};
                  
                  const allRequiredMatch = this.config.similarMatchRequiredParams.every((paramName: string) => {
                    const requestValue = requestParams[paramName];
                    const mockValue = mockParams[paramName];
                    return requestValue === undefined && mockValue === undefined 
                      ? true 
                      : String(requestValue || '') === String(mockValue || '');
                  });
                  
                  if (!allRequiredMatch) {
                    continue; // Required parameter differs, skip this mock
                  }
                }
              
                if (
                  mockShouldBeIncludedInRequestMatch(mockData, {
                    includePassthroughMocks,
                    filename,
                    scenarioPath,
                  })
                ) {
                  similarMatch = { mockData, filename, filePath };
                }
              }
            } catch (e) {
              continue;
            }
          }
        }
      } catch (error) {
        logger.warn(`[Mockifyer] Failed to load mock file ${filePath}:`, error);
      }
    }

    return exactMatch || similarMatch;
  }

  private loadMockData(): void {
    const fs = getFs();
    // Skip if using database provider or fs not available
    if (this.databaseProvider || !fs) {
      return;
    }
    if (fs.existsSync(this.config.mockDataPath)) {
      fs.readdirSync(this.config.mockDataPath)
        .filter(file => file.endsWith('.json'));
    }
  }

  private setupMockResponses(): void {
    this.httpClient.interceptors.request.use(async (config: any) => {
      // CRITICAL: Runtime toggle — if disabled, bypass all Mockifyer logic
      if (!this.runtimeEnabled) {
        (config as any).__mockifyer_bypass = true;
        return config;
      }

      // CRITICAL: Completely bypass Mockifyer interception for sync endpoints
      const url = config.url || '';
      if (containsMockifyerSyncEndpointMarker(url)) {
        (config as any).__mockifyer_skip_save = true;
        (config as any).__mockifyer_bypass = true;
        return config;
      }

      if (shouldBypassMockifyerForUrl(url, this.config.excludedUrls, this.config.baseUrl)) {
        (config as any).__mockifyer_bypass = true;
        return config;
      }

      if (!shouldApplyMockifyer(this.activationMode, config.headers)) {
        (config as any).__mockifyer_bypass = true;
        return config;
      }

      if (!isExplicitProxyScenarioContext(this.config)) {
        logger.warn(
          '[Mockifyer-Fetch] Strict proxy scenario: set clientId (lane) or proxy.scenario; passthrough HTTP for this request'
        );
        (config as any).__mockifyer_bypass = true;
        return config;
      }

      let correlation = await this.applyOutboundCorrelation(config);
      this.stashRequestCorrelation(config, correlation);

      // Normalize empty params: treat {} the same as undefined for consistent matching
      const rawParams = config.params || {};
      const anonymizedQueryParams = this.anonymizeQueryParams(rawParams);
      const normalizedParams = anonymizedQueryParams && Object.keys(anonymizedQueryParams).length > 0 
        ? anonymizedQueryParams 
        : undefined;
      
      const request: StoredRequest = {
        method: config.method || 'GET',
        url: config.url || '',
        headers: config.headers || {},
        data: config.data,
        queryParams: normalizedParams
      };

      const requestKey = this.generateRequestKey(request);
      
      // Store request key for response interceptor
      (config as any).__mockifyer_requestKey = requestKey;
      // Store request start time for duration calculation
      (config as any).__mockifyer_startTime = Date.now();

      // Dashboard proxy owns mock hits (Redis + server-side disk fallback). Do not short-circuit
      // from local mock-data while proxy.baseUrl is configured — that bypasses /api/proxy entirely.
      if (this.usesDashboardProxy()) {
        return config;
      }

      this.domainPathRules.discover(request.url, this.config.baseUrl);
      const trafficGate = this.domainPathRules.getTrafficGate(request.url, this.config.baseUrl);
      (config as any).__mockifyer_domain_path_may_record = trafficGate.mayRecord;
      if (!trafficGate.mayReplay) {
        logger.debug(
          `[Mockifyer-Fetch] Domain path rules: replay denied for ${request.method} ${request.url}` +
            (trafficGate.matchedDomainPath ? ` (rule: ${trafficGate.matchedDomainPath})` : ' (allowlist unmatched)')
        );
        return config;
      }
      
      const cachedMock = await this.findBestMatchingMock(request);
      
      // Return cached mock if found
      
      if (cachedMock) {
        const { mockData, filename, filePath } = cachedMock;
        correlation = this.bindStoredHopId(config, mockData, correlation) ?? correlation;
        if (mockShouldServeStoredBody(mockData)) {
          logger.info(
            `[Mockifyer-Fetch] Mock hit: ${request.method} ${request.url} → ${filename}` +
              (filePath ? ` (${filePath})` : '')
          );
          const path = getPath();
          const hitScenarioPath = path
            ? this.capabilities.getScenarioFolderPath(
                path.resolve(this.config.mockDataPath),
                this.capabilities.getCurrentScenario(path.resolve(this.config.mockDataPath), this.config.clientId)
              )
            : undefined;

          if (mockData.responseDelayMs && mockData.responseDelayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, mockData.responseDelayMs));
          }

          const mockResponseBody = this.prepareStoredResponseBody(mockData, filename, hitScenarioPath);
          const effectiveStatus = mockData.statusOverride ?? mockData.response.status;
          this.logNetworkEvent(
            {
              method: (request.method || 'GET').toUpperCase(),
              url: this.resolveLoggedRequestUrl(config, request.url),
              source: 'mock-hit',
              status: effectiveStatus,
              requestBody: request.data,
              responseBody: mockResponseBody,
            },
            correlation,
            request.headers ?? config.headers
          );
          const responseHeaders = {
            ...mockData.response.headers,
            'x-mockifyer': 'true',
            'x-mockifyer-timestamp': mockData.timestamp,
            'x-mockifyer-filename': filename,
            'x-mockifyer-filepath': filePath
          };

          await this.warmPoolResponseCache(mockData);

          const mockResponse = {
            data: mockResponseBody,
            status: effectiveStatus,
            statusText: 'OK',
            headers: responseHeaders,
            config: config as any
          };

          return {
            ...config,
            __mockResponse: Promise.resolve(mockResponse),
            __mockifyer_requestKey: requestKey
          } as any;
        }

        logger.info(
          `[Mockifyer-Fetch] Live refresh: ${request.method} ${request.url} → ${filename}` +
            (filePath ? ` (${filePath})` : '')
        );
        (config as any).__mockifyer_matchedMock = cachedMock;
      }

      // Check request limit BEFORE making real API call (only if no mock found and in record mode)
      if (this.config.recordMode) {
        // Browser: skip request limit check (needs fs)
      }

      if (this.config.failOnMissingMock) {
        const scenario = this.capabilities.getCurrentScenario(this.config.mockDataPath, this.config.clientId);
        const requestKey = this.generateRequestKey(request);
        throw new Error(
          `No mock data found for request: ${requestKey}\n` +
          `\n` +
          `Scenario: ${scenario}\n` +
          `Request key: ${requestKey}\n` +
          `\n` +
          `In replay mode with failOnMissingMock=true, all requests must have recorded mocks.\n` +
          `To fix:\n` +
          `  1. Record this request: set recordMode: true\n` +
          `  2. Or preload fixture: databaseProvider: { type: 'memory', options: { fixtures: [...] } }\n` +
          `  3. Or allow passthrough: set failOnMissingMock: false`
        );
      }

      return config;
    });
  }

  private setupResponseInterceptor(): void {
    this.httpClient.interceptors.response.use(
      async (response: any) => {
        // CRITICAL: Check for skip flag FIRST
        if ((response.config as any).__mockifyer_skip_save || (response.config as any).__mockifyer_bypass) {
          return response;
        }

        // Clean up processing requests tracking
        const requestKey = (response.config as any).__mockifyer_requestKey;
        if (requestKey) {
          this.processingRequests.delete(requestKey);
        }
        
        const isMocked = response.headers && (response.headers as any)['x-mockifyer'] === 'true';
        const isLimitReached = response.headers && (response.headers as any)['x-mockifyer-limit-reached'] === 'true';
        if (isMocked || isLimitReached) {
          const shouldLogMockOrLimit =
            isLimitReached || (isMocked && this.usesDashboardProxy());
          if (shouldLogMockOrLimit) {
            const url = response.config?.url || (response as any).request?.responseURL || (response as any).url || '';
            const reqUrl = this.resolveLoggedRequestUrl(response.config, url);
            const reqMethod = (response.config?.method || 'GET').toUpperCase();
            const startTime = (response.config as any).__mockifyer_startTime;
            const durationMs = startTime ? Date.now() - startTime : undefined;
            this.logNetworkEvent(
              {
                method: reqMethod,
                url: reqUrl,
                source: isLimitReached ? 'error' : 'mock-hit',
                status: response.status,
                durationMs,
                transport: this.usesDashboardProxy() ? 'proxy' : 'fetch',
                requestBody: response.config?.data,
                responseBody: response.data,
                ...(isLimitReached
                  ? {
                      errorMessage:
                        typeof response.data === 'object' &&
                        response.data !== null &&
                        'message' in response.data
                          ? String((response.data as { message?: unknown }).message)
                          : 'Request limit reached',
                    }
                  : {}),
              },
              this.readRequestCorrelation(response.config),
              response.config?.headers
            );
          }
          // Mock hits return before the upstream path
          this.unwrapResponseInlineTrace(response);
          return response;
        }

        if (this.config.proxy?.baseUrl && this.config.proxy?.mirrorRecordedMocksToClient) {
          await this.maybeMirrorProxyRecordingToClient(response);
        }

        const matchedMock = (response.config as any).__mockifyer_matchedMock as CachedMockData | undefined;
        if (matchedMock) {
          const startTime = (response.config as any).__mockifyer_startTime;
          const durationMs = startTime ? Date.now() - startTime : undefined;

          const url = response.config?.url || (response as any).request?.responseURL || (response as any).url || '';
          const reqUrl = this.resolveLoggedRequestUrl(response.config, url);
          const reqMethod = (response.config?.method || 'GET').toUpperCase();
          this.logNetworkEvent(
            {
              method: reqMethod,
              url: reqUrl,
              source: 'upstream',
              status: response.status,
              durationMs,
              requestBody: response.config?.data,
              responseBody: response.data,
            },
            this.readRequestCorrelation(response.config),
            response.config?.headers
          );
          this.unwrapResponseInlineTrace(response);

          const capturedResponse: StoredResponse = {
            status: response.status,
            data: stripMockifyerTraceFromBody(response.data),
            headers: (response.headers as Record<string, string>) || {},
          };

          if (resolveShouldPersistLiveCapture(matchedMock.mockData, this.config)) {
            await this.persistMatchedMockAfterLiveCapture(
              matchedMock,
              capturedResponse,
              durationMs,
              this.readRequestCorrelation(response.config)
            );
          }

          const path = getPath();
          const liveScenarioPath = path
            ? this.capabilities.getScenarioFolderPath(
                path.resolve(this.config.mockDataPath),
                this.capabilities.getCurrentScenario(path.resolve(this.config.mockDataPath), this.config.clientId)
              )
            : undefined;
          const clientResponse = buildClientResponseFromLiveCapture(
            matchedMock.mockData,
            capturedResponse,
            createServeTimeClock(this.config),
            { filename: matchedMock.filename, scenarioPath: liveScenarioPath }
          );
          response.data = clientResponse.data;
          response.status = clientResponse.status;
          delete (response.config as any).__mockifyer_matchedMock;

          return response;
        }

        const url = response.config?.url || (response as any).request?.responseURL || (response as any).url || '';
        const reqUrl = this.resolveLoggedRequestUrl(response.config, url);
        const reqMethod = (response.config?.method || 'GET').toUpperCase();
        this.logNetworkEvent(
          {
            method: reqMethod,
            url: reqUrl,
            source: 'upstream',
            status: response.status,
            durationMs:
              typeof response.config?.metadata?.durationMs === 'number'
                ? response.config.metadata.durationMs
                : undefined,
            requestBody: response.config?.data,
            responseBody: response.data,
          },
          this.readRequestCorrelation(response.config),
          response.config?.headers
        );
        this.unwrapResponseInlineTrace(response);

        // Only save locally if recordMode is enabled AND we're not proxying upstream calls.
        if (this.config.recordMode && !this.config.proxy?.baseUrl) {
          await this.saveResponse(response);
        }

        return response;
      },
      async (error: any) => {
        const requestKey = (error.config as any)?.__mockifyer_requestKey;
        if (requestKey) {
          this.processingRequests.delete(requestKey);
        }
        const reqUrl = this.resolveLoggedRequestUrl(error.config);
        if (reqUrl) {
          this.logNetworkEvent(
            {
              method: (error.config?.method || 'GET').toUpperCase(),
              url: reqUrl,
              source: 'error',
              status: error.response?.status,
              errorMessage: error?.message ?? String(error),
              requestBody: error.config?.data,
              responseBody: error.response?.data,
            },
            this.readRequestCorrelation(error.config),
            error.config?.headers
          );
        }
        this.throwWithMockifyerRequestId(error);
      }
    );
  }

  private async maybeMirrorProxyRecordingToClient(response: HTTPResponse): Promise<void> {
    const rec = response.mockifyerProxyRecording;
    if (!rec?.recordedToStore || !rec.storedMock) {
      return;
    }
    const hash = rec.hash?.trim();
    const scenarioName = rec.scenarioName?.trim();
    const mockData = rec.storedMock as MockData;
    const providerType = this.config.databaseProvider?.type;

    await mirrorProxyRecordingToClient({
      config: this.config,
      mockDataPath: this.config.mockDataPath,
      recording: rec,
      databaseProvider: this.databaseProvider,
      databaseProviderInitPromise: this.databaseProviderInitPromise,
      logPrefix: 'Mockifyer-Fetch',
    });

    const fs = getFs();
    if (providerType === 'hybrid' && hash && scenarioName && mockData) {
      await this.tryMirrorProxyRecordingViaMetro(mockData, scenarioName, hash);
    } else if (!fs && hash && scenarioName && mockData) {
      await this.tryMirrorProxyRecordingViaMetro(mockData, scenarioName, hash);
    }
  }

  private async tryMirrorProxyRecordingViaMetro(
    mockData: MockData,
    scenarioName: string,
    hash: string
  ): Promise<void> {
    const metroPort = process.env.METRO_PORT ? parseInt(process.env.METRO_PORT, 10) : 8081;
    const fetchFn = (global as any).__mockifyer_original_fetch || fetch;
    if (!fetchFn) {
      logger.warn('[Mockifyer-Fetch] Proxy client mirror: no fetch for Metro save');
      return;
    }
    try {
      const body = JSON.stringify({
        __mockifyerProxyMirror: true,
        mockData,
        scenarioName,
        relativePath: `redis/${hash}.json`,
      });
      const res = await fetchFn(`http://localhost:${metroPort}/mockifyer-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const text = await res.text().catch(() => '');
      if (!res.ok) {
        logger.warn(`[Mockifyer-Fetch] Proxy client mirror (Metro): HTTP ${res.status} ${text}`);
        return;
      }
      try {
        const parsed = JSON.parse(text) as { success?: boolean; error?: string };
        if (parsed.success === false) {
          logger.warn(`[Mockifyer-Fetch] Proxy client mirror (Metro): ${parsed.error || 'save failed'}`);
          return;
        }
      } catch {
        // non-JSON response
      }
      logger.info(`[Mockifyer-Fetch] Mirrored proxy recording (Metro): ${scenarioName}/redis/${hash}.json`);
    } catch (e) {
      logger.warn('[Mockifyer-Fetch] Proxy client mirror (Metro) failed:', e);
    }
  }

  private async saveResponse(response: HTTPResponse): Promise<void> {
    // CRITICAL: Check for bypass flags FIRST - if set, completely skip processing
    if ((response.config as any)?.__mockifyer_skip_save || (response.config as any)?.__mockifyer_bypass) {
      return;
    }

    // If using a proxy for upstream calls, do not save locally.
    if (this.config.proxy?.baseUrl) {
      return;
    }

    if (shouldBlockLocalMockRecording(this.config)) {
      logger.info(
        '[Mockifyer-Fetch] Strict proxy-only mode: skipping local mock save (dashboard proxy unavailable).'
      );
      return;
    }
    
    const url = response.config?.url || (response as any).request?.responseURL || (response as any).url || '';
    if (url && shouldBypassMockifyerForUrl(url, this.config.excludedUrls, this.config.baseUrl)) {
      return;
    }
    const recordingExclusions = resolveRecordingExclusions(this.config);
    if (
      url &&
      shouldExcludeRecording(url, recordingExclusions, this.config.baseUrl)
    ) {
      return;
    }

    const mayRecordFlag = (response.config as any)?.__mockifyer_domain_path_may_record;
    if (mayRecordFlag === false) {
      return;
    }
    if (mayRecordFlag !== true) {
      this.domainPathRules.discover(url, this.config.baseUrl);
      const gate = this.domainPathRules.getTrafficGate(url, this.config.baseUrl);
      if (!gate.mayRecord) {
        return;
      }
    }
    
    // Normalize empty params: treat {} the same as undefined for consistent matching
    const rawParams = response.config.params || {};
    const normalizedParams = rawParams && Object.keys(rawParams).length > 0 ? rawParams : undefined;
    
    const saveLookupRequest: StoredRequest = {
      method: response.config.method?.toUpperCase() || 'GET',
      url: response.config.url || '',
      headers: {},
      data: response.config.data,
      queryParams: normalizedParams,
    };

    const requestKey = this.generateRequestKey(saveLookupRequest);

    if (this.savingResponses.has(requestKey)) {
      return;
    }

    const existingMock = await this.findBestMatchingMock(saveLookupRequest, {
      includePassthroughMocks: true,
    });

    const saveDecision = resolveMockRecordingSaveDecision(
      this.config,
      existingMock?.mockData
    );

    if (saveDecision.action === 'skip') {
      if (existingMock && mockPassesThroughToRealApi(existingMock.mockData)) {
        logger.info(
          `[Mockifyer-Fetch] Passthrough mock exists for ${requestKey}, skipping save (enable refreshPassthroughRecordings to update).`
        );
      }
      return;
    }

    this.savingResponses.add(requestKey);

    try {
      const rawParamsForSave = response.config.params || {};
      const anonymizedQueryParams = this.anonymizeQueryParams(rawParamsForSave);
      const normalizedParamsForSave =
        anonymizedQueryParams && Object.keys(anonymizedQueryParams).length > 0
          ? anonymizedQueryParams
          : undefined;

      const now = Date.now();
      if (!this.currentSessionId || now - this.sessionStartTime > this.SESSION_TIMEOUT_MS) {
        this.currentSessionId = `session-${now}-${Math.random().toString(36).substring(2, 11)}`;
        this.sessionStartTime = now;
      }

      const startTime = (response.config as any).__mockifyer_startTime;
      const duration = startTime ? Date.now() - startTime : undefined;

      const correlation = this.readRequestCorrelation(response.config);
      const hopIds = resolvePersistedHopIds(
        saveDecision.action === 'overwrite' ? existingMock?.mockData : undefined,
        correlation
      );

      const storedRequest: StoredRequest = {
        method: response.config?.method?.toUpperCase() || 'GET',
        url: response.config?.url || '',
        headers: this.anonymizeHeaders(response.config?.headers || {}),
        data: response.config?.data,
        queryParams: normalizedParamsForSave,
      };
      // Prefer explicit override / config; else request-only default (same as proxy).
      // Use URL-aware resolution for selective recording.
      const configValue =
        this.recordResponsesOverride ??
        this.config.proxy?.recordResponses ??
        this.config.recordResponses;
      const recordBodies = resolveLocalRecordResponsesForUrl(storedRequest.url, configValue, this.config.baseUrl);
      const mockData = buildLocalRecordingMockData({
        request: storedRequest,
        response: {
          status: response.status,
          data: response.data,
          headers: response.headers || {},
        },
        recordResponses: recordBodies,
        meta: {
          timestamp: new Date().toISOString(),
          duration,
          sessionId:
            saveDecision.action === 'overwrite' && existingMock?.mockData.sessionId
              ? existingMock.mockData.sessionId
              : this.currentSessionId,
          requestId: hopIds.requestId,
          parentRequestId: hopIds.parentRequestId,
          parentRequestIds: hopIds.parentRequestIds,
          // Allowlisted URLs (recordBodies=true) should NOT have alwaysUseRealApi
          // so they replay immediately. Request-only stubs need alwaysUseRealApi.
          ...(!recordBodies
            ? { alwaysUseRealApi: true as const }
            : {}),
        },
      });

      applyRecordingPassthroughFlag(mockData, saveDecision.alwaysUseRealApi);

      if (this.databaseProvider) {
        try {
          await this.databaseProvider.save(mockData);

          if (this.config.generateTests?.enabled) {
            await this.generateTestForMock(mockData);
          }
        } catch (error) {
          console.error(
            `[Mockifyer-Fetch] ❌ Error saving mock using ${this.config.databaseProvider?.type} provider:`,
            error
          );
          throw error;
        }
      } else {
        const fs = getFs();
        const path = getPath();
        if (fs && path) {
          const currentScenario = this.capabilities.getCurrentScenario(this.config.mockDataPath, this.config.clientId);
          const scenarioPath = this.capabilities.getScenarioFolderPath(this.config.mockDataPath, currentScenario);
          this.capabilities.ensureScenarioFolder(this.config.mockDataPath, currentScenario);

          if (saveDecision.action === 'overwrite' && existingMock?.filePath) {
            fs.writeFileSync(existingMock.filePath, JSON.stringify(mockData, null, 2));
            logger.info(
              `[Mockifyer] Refreshed passthrough mock: ${currentScenario}/${existingMock.filename}`
            );
          } else {
            const { dir, filename } = getMockFilePath(mockData, formatDateStr(getCurrentDate()));
            const filePath = path.join(scenarioPath, dir, filename);
            fs.mkdirSync(path.join(scenarioPath, dir), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
            logger.info(
              `[Mockifyer] Saved new mock to file: ${currentScenario}/${dir ? `${dir}/` : ''}${filename}`
            );
          }

          if (this.config.generateTests?.enabled && this.testGenerator) {
            await this.generateTestForMock(mockData);
          }
        } else {
          console.warn('[Mockifyer] Cannot save mock: no database provider and fs/path not available');
        }
      }

      // Update domain path rule to allow replay for allowlisted responses
      if (recordBodies) {
        this.domainPathRules.enableAutoMockForUrl(storedRequest.url, this.config.baseUrl);
      }
    } finally {
      this.savingResponses.delete(requestKey);
    }
  }

  private async persistMatchedMockAfterLiveCapture(
    cachedMock: CachedMockData,
    capturedResponse: StoredResponse,
    durationMs?: number,
    liveCorrelation?: RequestCorrelationContext
  ): Promise<void> {
    const updated = buildMockDataAfterLiveCapture(cachedMock.mockData, capturedResponse, durationMs);
    applyPersistedHopIds(updated, resolvePersistedHopIds(cachedMock.mockData, liveCorrelation));

    if (this.databaseProvider) {
      await this.databaseProvider.save(updated);
      return;
    }

    const fs = getFs();
    if (fs && cachedMock.filePath) {
      fs.writeFileSync(cachedMock.filePath, JSON.stringify(updated, null, 2));
      logger.info(`[Mockifyer-Fetch] Refreshed mock from live API: ${cachedMock.filename}`);
    }
  }

  /**
   * Generates test file for a mock
   */
  private async generateTestForMock(mockData: MockData): Promise<void> {
    if (!this.testGenerator) {
      return;
    }
    
    // Browser: skip test generation (needs fs)
    return;
  }

  private anonymizeHeaders(headers: Record<string, any>): Record<string, any> {
    const defaultHeadersToAnonymize = [
      'x-rapidapi-key', 'x-api-key', 'authorization', 'api-key', 'apikey',
      'x-auth-token', 'x-access-token', 'bearer'
    ];
    
    const headersToAnonymize = this.config.anonymizeHeaders !== undefined
      ? this.config.anonymizeHeaders
      : defaultHeadersToAnonymize;
    
    if (headersToAnonymize.length === 0) {
      return headers;
    }
    
    const anonymized = { ...headers };
    const lowerCaseHeadersToAnonymize = headersToAnonymize.map((h: string) => h.toLowerCase());
    
    Object.keys(anonymized).forEach(key => {
      if (lowerCaseHeadersToAnonymize.includes(key.toLowerCase())) {
        anonymized[key] = '***';
      }
    });
    
    return anonymized;
  }

  private anonymizeQueryParams(params: Record<string, any>): Record<string, any> {
    const defaultParamsToAnonymize = ['key', 'api_key', 'apikey', 'token', 'access_token'];
    
    const paramsToAnonymize = this.config.anonymizeQueryParams !== undefined
      ? this.config.anonymizeQueryParams
      : defaultParamsToAnonymize;
    
    if (paramsToAnonymize.length === 0) {
      return params;
    }
    
    const anonymized = { ...params };
    const lowerCaseParamsToAnonymize = paramsToAnonymize.map((p: string) => p.toLowerCase());
    
    Object.keys(anonymized).forEach(key => {
      if (lowerCaseParamsToAnonymize.includes(key.toLowerCase())) {
        anonymized[key] = '***';
      }
    });
    
    return anonymized;
  }

  /**
   * Updates the logical client lane for subsequent requests (headers, proxy envelope, scenario paths, Redis).
   * Does not re-read native launch arguments or environment variables.
   */
  setClientId(lane: string): void {
    const t = String(lane).trim();
    if (!t) {
      throw new Error('[Mockifyer-Fetch] setClientId requires a non-empty string');
    }
    this.config.clientId = t;
    logger.info(`[Mockifyer-Fetch] clientId set to: ${t}`);
  }

  /** Current logical lane id (same value used for isolation). */
  getClientId(): string | undefined {
    return this.config.clientId;
  }

  /**
   * Turn record mode on/off at runtime (dev menus, tests).
   */
  setRecordMode(enabled: boolean): void {
    const next = Boolean(enabled);
    this.config.recordMode = next;
    if (next) {
      this.config.failOnMissingMock = false;
      this.domainPathRules.enableRecordResponsesForAllRules();
    }
    if (this.config.proxy?.baseUrl) {
      this.config.proxy = {
        ...this.config.proxy,
        recordOnMiss: next,
      };
      const client = this.httpClient as FetchHTTPClient & {
        setProxyRecordOnMiss?: (value: boolean | undefined) => void;
      };
      client.setProxyRecordOnMiss?.(next);
    }
    logger.info(`[Mockifyer-Fetch] recordMode set to: ${next}`);
  }

  /** Whether newly unmatched requests can be recorded (local or proxy record-on-miss). */
  isRecordMode(): boolean {
    return this.config.recordMode === true;
  }

  /**
   * Whether new recordings store full response bodies (true) or request-only stubs (false, default).
   */
  setRecordResponses(enabled: boolean): void {
    const next = Boolean(enabled);
    this.recordResponsesOverride = next;
    this.config.recordResponses = next;
    if (this.config.proxy) {
      this.config.proxy = {
        ...this.config.proxy,
        recordResponses: next,
      };
    }
    const client = this.httpClient as FetchHTTPClient & {
      setProxyRecordResponses?: (value: boolean) => void;
    };
    client.setProxyRecordResponses?.(next);
    logger.info(`[Mockifyer-Fetch] recordResponses (store bodies) set to: ${next}`);
  }

  /** True when new recordings include response bodies (not request-only stubs). */
  isRecordResponses(): boolean {
    const configValue = this.recordResponsesOverride ??
      (this.config.proxy?.baseUrl ? this.config.proxy.recordResponses : this.config.recordResponses);
    
    // Check env override first (applies to both boolean and array configs)
    const { envRecordResponsesOverride } = require('@sgedda/mockifyer-core/src/utils/request-only-mock');
    const envOverride = envRecordResponsesOverride();
    if (envOverride !== undefined) {
      return envOverride;
    }
    
    // If config is an array, return true if non-empty (at least some URLs will record)
    if (Array.isArray(configValue)) {
      return configValue.length > 0;
    }
    
    // For boolean configs, use the old resolvers
    if (this.config.proxy?.baseUrl) {
      return resolveRecordResponses(configValue);
    }
    return resolveLocalRecordResponses(configValue);
  }

  /**
   * Enable Mockifyer at runtime.
   */
  enableMockifyer(): void {
    this.runtimeEnabled = true;
    logger.info('[Mockifyer-Fetch] Mockifyer enabled at runtime');
    void this.persistRuntimeEnabledState(true);
  }

  /**
   * Disable Mockifyer at runtime.
   */
  disableMockifyer(): void {
    this.runtimeEnabled = false;
    logger.info('[Mockifyer-Fetch] Mockifyer disabled at runtime - all requests will bypass');
    void this.persistRuntimeEnabledState(false);
  }

  /**
   * Check if Mockifyer is currently enabled at runtime.
   */
  isMockifyerEnabled(): boolean {
    return this.runtimeEnabled;
  }

  private async persistRuntimeEnabledState(enabled: boolean): Promise<void> {
    if (!this.runtimeEnabledStorage) {
      return;
    }
    await savePersistedRuntimeEnabled(this.runtimeEnabledStorage, enabled);
  }

  getHTTPClient(): HTTPClient {
    return this.httpClient;
  }

  async reloadMockData(syncFromProject: boolean = true): Promise<void> {
    await this.databaseProviderInitPromise;
    this.poolResponseCache.clear();
    if (this.databaseProvider && typeof (this.databaseProvider as any).reload === 'function') {
      if (syncFromProject && typeof (this.databaseProvider as any).reload === 'function') {
        await (this.databaseProvider as any).reload(syncFromProject);
      } else {
        await (this.databaseProvider as any).reload();
      }
    } else {
      if (typeof (this as any).loadMockData === 'function') {
        (this as any).loadMockData();
      }
    }
    this.domainPathRules.invalidateCache();
    await this.domainPathRules.hydrate();
  }

  clearStaleCacheEntries(): number {
    return 0; // No cache in fetch implementation
  }

  async clearAllMocks(): Promise<void> {
    if (this.databaseProvider && typeof this.databaseProvider.clearAll === 'function') {
      await this.databaseProvider.clearAll();
    } else {
      logger.warn('[Mockifyer-Fetch] Provider does not support clearAll()');
    }
  }
}
