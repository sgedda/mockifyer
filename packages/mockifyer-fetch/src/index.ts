// Fetch-only Mockifyer implementation
// Conditionally import fs - will be undefined in React Native
let fs: typeof import('fs') | undefined;
let path: typeof import('path') | undefined;

try {
  // Try to require fs and path - will fail in React Native where they're stubbed
  fs = require('fs');
  path = require('path');
} catch (e) {
  // fs/path not available (React Native environment)
  fs = undefined;
  path = undefined;
}

// Import from core package
import {
  MockifyerConfig,
  MockData,
  StoredRequest,
  StoredResponse,
  HTTPClient,
  HTTPResponse,
  generateRequestKey as generateRequestKeyUtil,
  CachedMockData,
  initializeDateManipulation,
  DatabaseProvider,
  createProvider,
  getCurrentScenario,
  getScenarioFolderPath,
  ensureScenarioFolder,
  initializeScenario,
  TestGenerator,
  TestGenerationOptions,
  checkRequestLimit,
  prepareMockResponseBody,
  getCurrentDate,
  shouldExcludeUrl,
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
  registerMockifyerInstance,
  logMockifyerInitSummary,
  tryGetClientIdFromLaunchArguments,
  MOCKIFYER_LAUNCH_ARGUMENT_CLIENT_ID_KEY,
  resolveActivationMode,
  shouldApplyMockifyer,
  isExplicitProxyScenarioContext,
  parseProxyRecordOnMissEnv,
  newRecordingUsesAlwaysUseRealApi,
  shouldBlockLocalMockRecording,
  resolveStrictScenarioResolution,
  type MockifyerActivationMode,
  emitMockifyerNetworkEvent,
  networkEventHashFromRequestKey,
  resolveRecordResponses,
  applyOutboundRequestCorrelation,
  type RequestCorrelationContext,
  installNodeInboundRequestCorrelationCapture,
} from '@sgedda/mockifyer-core';
import { logger, setLogLevel } from '@sgedda/mockifyer-core';

import { FetchHTTPClient } from './clients/fetch-client';
import { canUseDashboardRedisProxy } from './utils/dashboard-redis-health';

/**
 * When `proxy.baseUrl` is set and `proxy.recordOnMiss` is omitted, apply `MOCKIFYER_PROXY_RECORD_ON_MISS` if set.
 */
function applyProxyRecordOnMissEnv(config: MockifyerConfig): MockifyerConfig {
  const proxy = config.proxy;
  const baseUrl = proxy?.baseUrl?.trim();
  if (!proxy || !baseUrl || proxy.recordOnMiss !== undefined) {
    return config;
  }
  const parsed = parseProxyRecordOnMissEnv();
  if (parsed === undefined) {
    return config;
  }
  return {
    ...config,
    proxy: {
      baseUrl: proxy.baseUrl,
      scenario: proxy.scenario,
      recordOnMiss: parsed,
      strictLaneScenario: proxy.strictLaneScenario,
      mirrorRecordedMocksToClient: proxy.mirrorRecordedMocksToClient,
    },
  };
}

class MockifyerClass {
  private config: MockifyerConfig;
  private httpClient: HTTPClient;
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

  /** Best-effort dashboard network log (skipped when traffic goes through `proxy.baseUrl`). */
  private logNetworkEvent(
    partial: Parameters<typeof emitMockifyerNetworkEvent>[0]['event'] & { transport?: 'fetch' },
    correlation?: RequestCorrelationContext
  ): void {
    if (this.config.proxy?.baseUrl) return;
    const scenario =
      this.config.proxy?.scenario?.trim() ||
      getCurrentScenario(this.config.mockDataPath);
    emitMockifyerNetworkEvent({
      config: this.config,
      scenario,
      clientId: this.config.clientId,
      event: {
        ...partial,
        transport: partial.transport ?? 'fetch',
        requestId: correlation?.requestId ?? partial.requestId,
        parentRequestId: correlation?.parentRequestId ?? partial.parentRequestId,
      },
    });
  }

  private stashRequestCorrelation(config: unknown, correlation: RequestCorrelationContext): void {
    (config as { __mockifyer_requestId?: string; __mockifyer_parentRequestId?: string }).__mockifyer_requestId =
      correlation.requestId;
    (config as { __mockifyer_parentRequestId?: string }).__mockifyer_parentRequestId =
      correlation.parentRequestId;
  }

  private readRequestCorrelation(config: unknown): RequestCorrelationContext | undefined {
    const requestId = (config as { __mockifyer_requestId?: string }).__mockifyer_requestId;
    if (!requestId) return undefined;
    const parentRequestId = (config as { __mockifyer_parentRequestId?: string }).__mockifyer_parentRequestId;
    return parentRequestId ? { requestId, parentRequestId } : { requestId };
  }

  constructor(config: MockifyerConfig) {
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
    
    let launchClientId: string | undefined;
    if (config.useLaunchArgumentsClientId) {
      const key = config.launchArgumentClientIdKey ?? MOCKIFYER_LAUNCH_ARGUMENT_CLIENT_ID_KEY;
      launchClientId = tryGetClientIdFromLaunchArguments(key);
      if (launchClientId) {
        logger.info(`[Mockifyer-Fetch] clientId from launch arguments (${key}): ${launchClientId}`);
      }
    }

    // Store config BEFORE any modifications
    this.config = { ...config }; // Create a copy to avoid mutations

    // Launch arg wins over MOCKIFYER_CLIENT_ID / config.clientId when present (E2E).
    if (launchClientId) {
      this.config.clientId = launchClientId;
    } else if (
      resolveStrictScenarioResolution(this.config) &&
      Boolean(this.config.proxy?.baseUrl?.trim())
    ) {
      // Strict proxy: no auto lane until explicit clientId / setClientId (devtools show real URLs).
      this.config.clientId = resolveExplicitClientIdOnly(this.config);
    } else {
      this.config.clientId = resolveClientId(this.config);
    }
    this.activationMode = resolveActivationMode(this.config);

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

    logMockifyerInitSummary(this.config, {
      runtimeMode: this.config.runtimeMode,
      headline: this.config.initLog?.headline,
    });
  }

  private ensureMockDataDirectory(): void {
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

  private async findBestMatchingMock(
    request: StoredRequest,
    options?: { includePassthroughMocks?: boolean }
  ): Promise<CachedMockData | undefined> {
    // CRITICAL: Never try to match sync endpoint requests - they should never be mocked
    const requestUrl = request?.url || '';
    if (requestUrl.includes('/mockifyer-save') || 
        requestUrl.includes('/mockifyer-clear') || 
        requestUrl.includes('/mockifyer-sync')) {
      return undefined;
    }
    
    const requestKey = this.generateRequestKey(request);
    
    // CRITICAL: Also check requestKey for sync endpoint URLs (defense in depth)
    if (requestKey.includes('/mockifyer-save') || 
        requestKey.includes('/mockifyer-clear') || 
        requestKey.includes('/mockifyer-sync')) {
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
    if (requestUrl.includes('/mockifyer-save') || 
        requestUrl.includes('/mockifyer-clear') || 
        requestUrl.includes('/mockifyer-sync')) {
      return undefined;
    }

    const requestKey = this.generateRequestKey(request);
    
    // CRITICAL: Also check requestKey for sync endpoint URLs (defense in depth)
    if (requestKey.includes('/mockifyer-save') || 
        requestKey.includes('/mockifyer-clear') || 
        requestKey.includes('/mockifyer-sync')) {
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

  private findBestMatchingMockFromFiles(
    request: StoredRequest,
    options?: { includePassthroughMocks?: boolean }
  ): CachedMockData | undefined {
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

    const currentScenario = getCurrentScenario(resolvedMockDataPath, this.config.clientId);
    const scenarioPath = getScenarioFolderPath(resolvedMockDataPath, currentScenario);
    
    if (!fs.existsSync(scenarioPath)) {
      logger.warn('[Mockifyer-Fetch] ⚠️ Scenario path does not exist:', scenarioPath);
      return undefined;
    }

    const files = fs.readdirSync(scenarioPath)
      .filter(file => file.endsWith('.json'));

    const requestKey = this.generateRequestKey(request);
    let exactMatch: CachedMockData | undefined;
    let similarMatch: CachedMockData | undefined;
    
    for (const file of files) {
      try {
        const filePath = path!.join(scenarioPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const mockData: MockData = JSON.parse(fileContent);
        
        if (!mockData || !mockData.request || typeof mockData.request !== 'object') {
          continue;
        }
        
        const mockKey = this.generateRequestKey(mockData.request);
        
        if (mockKey === requestKey) {
          if (mockShouldBeIncludedInRequestMatch(mockData, { includePassthroughMocks })) {
            exactMatch = { mockData, filename: file, filePath };
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
              
              // Check for pattern-based match (e.g., /posts/71 matches /posts/17 when similarMatchIgnoreAllQueryParams is true)
              // This allows matching paths with different IDs when we're ignoring query params
              let patternMatch = false;
              if (this.config.similarMatchIgnoreAllQueryParams && !exactPathnameMatch && methodMatch) {
                // Extract base path by removing the last segment (ID)
                // /posts/71 -> /posts, /users/2/todos -> /users/2
                const requestSegments = requestPathname.split('/').filter(s => s);
                const mockSegments = mockPathname.split('/').filter(s => s);
                
                // Match if base paths are the same (same number of segments, all but last match)
                if (requestSegments.length === mockSegments.length && requestSegments.length > 0) {
                  const requestBase = requestSegments.slice(0, -1);
                  const mockBase = mockSegments.slice(0, -1);
                  patternMatch = requestBase.join('/') === mockBase.join('/');
                }
              }
              
              const pathnameMatch = exactPathnameMatch || patternMatch;
              
              // Check similar match
              
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
              
                if (!mockPassesThroughToRealApi(mockData)) {
                  similarMatch = { mockData, filename: file, filePath };
                }
              }
            } catch (e) {
              continue;
            }
          }
        }
      } catch (error) {
        logger.warn(`[Mockifyer] Failed to load mock file ${file}:`, error);
      }
    }

    return exactMatch || similarMatch;
  }

  private loadMockData(): void {
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
      // CRITICAL: Completely bypass Mockifyer interception for sync endpoints
      // This prevents any Mockifyer processing (mocking, saving, etc.) for these endpoints
      const url = config.url || '';
      if (url.includes('/mockifyer-save') || url.includes('/mockifyer-clear') || url.includes('/mockifyer-sync')) {
        // Mark this request to completely skip Mockifyer processing
        (config as any).__mockifyer_skip_save = true;
        (config as any).__mockifyer_bypass = true;
        return config;
      }

      if (
        !shouldApplyMockifyer(this.activationMode, config.headers, {
          useProxyLane: { proxyBaseUrl: this.config.proxy?.baseUrl, resolvedClientId: this.config.clientId },
        })
      ) {
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

      const correlation = applyOutboundRequestCorrelation(config);
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
      
      const cachedMock = await this.findBestMatchingMock(request);
      
      // Return cached mock if found
      
      if (cachedMock) {
        const { mockData, filename, filePath } = cachedMock;
        if (mockShouldServeStoredBody(mockData)) {
          logger.info(
            `[Mockifyer-Fetch] Mock hit: ${request.method} ${request.url} → ${filename}` +
              (filePath ? ` (${filePath})` : '')
          );
          this.logNetworkEvent(
            {
              method: (request.method || 'GET').toUpperCase(),
              url: request.url,
              source: 'mock-hit',
              status: mockData.response.status,
              requestHash: networkEventHashFromRequestKey(requestKey),
            },
            correlation
          );
          const responseHeaders = {
            ...mockData.response.headers,
            'x-mockifyer': 'true',
            'x-mockifyer-timestamp': mockData.timestamp,
            'x-mockifyer-filename': filename,
            'x-mockifyer-filepath': filePath
          };

          const mockResponse = {
            data: prepareMockResponseBody(mockData, getCurrentDate),
            status: mockData.response.status,
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
        const limitCheck = checkRequestLimit(this.config.mockDataPath);
        if (limitCheck.limitReached && limitCheck.error) {
          console.warn(`[Mockifyer] ⚠️ ${limitCheck.error.message}`);
          
          // Return a mock error response instead of making a real API call
          const responseHeaders = {
            'x-mockifyer': 'true',
            'x-mockifyer-limit-reached': 'true',
            'content-type': 'application/json'
          };
          
          const mockErrorResponse = {
            data: {
              error: limitCheck.error.message,
              message: limitCheck.error.message,
              limitReached: true,
              maxRequests: limitCheck.error.maxRequests,
              currentScenario: limitCheck.error.currentScenario
            },
            status: 429, // Too Many Requests
            statusText: 'Too Many Requests',
            headers: responseHeaders,
            config: config as any
          };
          
          return {
            ...config,
            __mockResponse: Promise.resolve(mockErrorResponse),
            __mockifyer_requestKey: requestKey,
            __mockifyer_limit_reached: true
          } as any;
        }
      }

      if (this.config.failOnMissingMock) {
        throw new Error(`No mock data found for request: ${this.generateRequestKey(request)}`);
      }

      return config;
    });
  }

  private setupResponseInterceptor(): void {
    this.httpClient.interceptors.response.use(
      async (response: any) => {
        // CRITICAL: Check for skip flag FIRST (set by request interceptor for sync endpoints)
        // This completely bypasses Mockifyer interception for sync endpoints
        if ((response.config as any).__mockifyer_skip_save || (response.config as any).__mockifyer_bypass) {
          return response;
        }

        // CRITICAL: Skip Mockifyer sync endpoints to prevent infinite loops
        // Check multiple ways to get the URL in case response.config is undefined
        const url = response.config?.url || response.request?.responseURL || response.url || (response as any).config?.url || '';
        
        // CRITICAL: Check URL FIRST before any other processing
        if (url && (url.includes('/mockifyer-save') || url.includes('/mockifyer-clear') || url.includes('/mockifyer-sync'))) {
          // Mark as bypassed to prevent any further processing
          (response.config as any).__mockifyer_skip_save = true;
          (response.config as any).__mockifyer_bypass = true;
          return response;
        }
        
        // Clean up processing requests tracking
        const requestKey = (response.config as any).__mockifyer_requestKey;
        if (requestKey) {
          this.processingRequests.delete(requestKey);
        }
        
        // CRITICAL: Check response data for Metro rejection messages (defense in depth)
        // This catches any responses that might have gotten through
        try {
          let responseDataStr = '';
          let responseDataObj: any = null;
          
          if (typeof response.data === 'string') {
            responseDataStr = response.data;
            try {
              responseDataObj = JSON.parse(response.data);
            } catch (e) {
              // Not JSON, that's fine
            }
          } else if (response.data) {
            // Try to stringify, but handle circular references
            try {
              responseDataStr = JSON.stringify(response.data);
              responseDataObj = response.data;
            } catch (stringifyError) {
              // If stringify fails, try to get a string representation
              responseDataStr = String(response.data);
            }
          }
          
          // CRITICAL: Check for Metro rejection message
          const hasRejectionMessage = responseDataStr && (
            responseDataStr.includes('Cannot save Mockifyer sync endpoint') ||
            responseDataStr.includes('Cannot save Mockifyer sync endpoint requests')
          );
          
          const hasRejectionInObject = responseDataObj && (
            (responseDataObj.error && typeof responseDataObj.error === 'string' && 
             responseDataObj.error.includes('Cannot save Mockifyer sync endpoint')) ||
            (responseDataObj.success === false && responseDataObj.error)
          );
          
          if (hasRejectionMessage || hasRejectionInObject) {
            return response;
          }
          
          // CRITICAL: Check for sync endpoint URLs in response data
          if (responseDataStr && (
              responseDataStr.includes('/mockifyer-save') || 
              responseDataStr.includes('/mockifyer-clear') || 
              responseDataStr.includes('/mockifyer-sync'))) {
            return response;
          }
        } catch (e) {
          // Ignore errors - continue processing
          logger.warn('[Mockifyer-Fetch] Error checking response data:', e);
        }
        
        const isMocked = response.headers && (response.headers as any)['x-mockifyer'] === 'true';
        const isLimitReached = response.headers && (response.headers as any)['x-mockifyer-limit-reached'] === 'true';
        if (isMocked || isLimitReached) {
          return response;
        }

        if (this.config.proxy?.baseUrl && this.config.proxy?.mirrorRecordedMocksToClient) {
          await this.maybeMirrorProxyRecordingToClient(response);
        }

        const matchedMock = (response.config as any).__mockifyer_matchedMock as CachedMockData | undefined;
        if (matchedMock) {
          const capturedResponse: StoredResponse = {
            status: response.status,
            data: response.data,
            headers: (response.headers as Record<string, string>) || {},
          };
          const startTime = (response.config as any).__mockifyer_startTime;
          const durationMs = startTime ? Date.now() - startTime : undefined;

          if (resolveShouldPersistLiveCapture(matchedMock.mockData, this.config)) {
            await this.persistMatchedMockAfterLiveCapture(matchedMock, capturedResponse, durationMs);
          }

          const clientResponse = buildClientResponseFromLiveCapture(
            matchedMock.mockData,
            capturedResponse,
            getCurrentDate
          );
          response.data = clientResponse.data;
          response.status = clientResponse.status;
          delete (response.config as any).__mockifyer_matchedMock;

          const reqUrl = response.config?.url || url;
          const reqMethod = (response.config?.method || 'GET').toUpperCase();
          this.logNetworkEvent(
            {
              method: reqMethod,
              url: reqUrl,
              source: 'upstream',
              status: response.status,
              durationMs,
            },
            this.readRequestCorrelation(response.config)
          );
          return response;
        }

        // Only save locally if recordMode is enabled AND we're not proxying upstream calls.
        // When proxy is configured, recording should happen on the proxy (e.g. dashboard → Redis).
        if (this.config.recordMode && !this.config.proxy?.baseUrl) {
          await this.saveResponse(response);
        }

        const reqUrl = response.config?.url || url;
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
          },
          this.readRequestCorrelation(response.config)
        );

        return response;
      },
      async (error: any) => {
        const requestKey = (error.config as any)?.__mockifyer_requestKey;
        if (requestKey) {
          this.processingRequests.delete(requestKey);
        }
        const reqUrl = error.config?.url || '';
        if (reqUrl) {
          this.logNetworkEvent(
            {
              method: (error.config?.method || 'GET').toUpperCase(),
              url: reqUrl,
              source: 'error',
              status: error.response?.status,
              errorMessage: error?.message ?? String(error),
            },
            this.readRequestCorrelation(error.config)
          );
        }
        throw error;
      }
    );
  }

  /**
   * When dashboard proxy records to Redis, optionally persist the same payload next to the client
   * (Node fs, database provider with `SaveMockOptions.scenario`, or Metro /mockifyer-save for strict RN).
   */
  private async maybeMirrorProxyRecordingToClient(response: HTTPResponse): Promise<void> {
    const rec = response.mockifyerProxyRecording;
    if (!rec?.recordedToStore || !rec.storedMock) {
      return;
    }
    const hash = rec.hash?.trim();
    const scenarioName = rec.scenarioName?.trim();
    if (!hash || !scenarioName) {
      logger.warn('[Mockifyer-Fetch] Proxy client mirror skipped: missing hash or scenario from proxy');
      return;
    }
    const mockData = rec.storedMock as MockData;
    const url = mockData?.request?.url || '';
    if (shouldExcludeUrl(url, this.config.excludedUrls)) {
      return;
    }

    await this.databaseProviderInitPromise;

    const providerType = this.config.databaseProvider?.type;
    if (this.databaseProvider && providerType !== 'memory') {
      try {
        const out = this.databaseProvider.save(mockData, {
          relativePath: `redis/${hash}.json`,
          scenario: scenarioName,
        });
        if (out instanceof Promise) {
          await out;
        }
        logger.info(`[Mockifyer-Fetch] Mirrored proxy recording (${providerType}): ${scenarioName}/redis/${hash}.json`);
        if (providerType === 'hybrid') {
          await this.tryMirrorProxyRecordingViaMetro(mockData, scenarioName, hash);
        }
      } catch (e) {
        logger.error('[Mockifyer-Fetch] Proxy client mirror (provider) failed:', e);
      }
      return;
    }

    if (fs && path) {
      try {
        ensureScenarioFolder(this.config.mockDataPath, scenarioName);
        const scenarioPath = getScenarioFolderPath(this.config.mockDataPath, scenarioName);
        const filePath = path.join(scenarioPath, 'redis', `${hash}.json`);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
        logger.info(`[Mockifyer-Fetch] Mirrored proxy recording (filesystem): ${scenarioName}/redis/${hash}.json`);
      } catch (e) {
        logger.error('[Mockifyer-Fetch] Proxy client mirror (Node fs) failed:', e);
      }
      return;
    }

    await this.tryMirrorProxyRecordingViaMetro(mockData, scenarioName, hash);
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
    // Proxy mode can record into Redis on miss (recordOnMiss) and keeps the app runtime stateless.
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
    if (url && shouldExcludeUrl(url, this.config.excludedUrls)) {
      return;
    }
    
      // CRITICAL: Check response data for sync endpoint references and Metro rejection messages
      // This is a defense-in-depth measure
      try {
        let responseDataStr = '';
        if (typeof response.data === 'string') {
          responseDataStr = response.data;
        } else if (response.data) {
          try {
            responseDataStr = JSON.stringify(response.data);
          } catch (stringifyError) {
            responseDataStr = String(response.data);
          }
        }
      
        // CRITICAL: Check for Metro rejection message
      if (responseDataStr && responseDataStr.includes('Cannot save Mockifyer sync endpoint')) {
        return;
      }
      
      // CRITICAL: Check for sync endpoint URLs in response data
      if (responseDataStr && (
          responseDataStr.includes('/mockifyer-save') || 
          responseDataStr.includes('/mockifyer-clear') || 
          responseDataStr.includes('/mockifyer-sync'))) {
        return;
      }
    } catch (e) {
      // Ignore JSON stringify errors
      logger.warn('[Mockifyer-Fetch] Error checking response data in saveResponse:', e);
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

      const mockData: MockData = {
        request: {
          method: response.config?.method?.toUpperCase() || 'GET',
          url: response.config?.url || '',
          headers: this.anonymizeHeaders(response.config?.headers || {}),
          data: response.config?.data,
          queryParams: normalizedParamsForSave,
        },
        response: {
          status: response.status,
          data: response.data,
          headers: response.headers || {},
        },
        timestamp: new Date().toISOString(),
        duration,
        sessionId:
          saveDecision.action === 'overwrite' && existingMock?.mockData.sessionId
            ? existingMock.mockData.sessionId
            : this.currentSessionId,
        requestId: correlation?.requestId,
        parentRequestId: correlation?.parentRequestId,
        ...(newRecordingUsesAlwaysUseRealApi() ? { alwaysUseRealApi: true as const } : {}),
      };

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
      } else if (fs && path) {
        const currentScenario = getCurrentScenario(this.config.mockDataPath, this.config.clientId);
        const scenarioPath = getScenarioFolderPath(this.config.mockDataPath, currentScenario);
        ensureScenarioFolder(this.config.mockDataPath, currentScenario);

        const limitCheck = checkRequestLimit(this.config.mockDataPath);
        if (limitCheck.limitReached && limitCheck.error) {
          console.warn(`[Mockifyer] ⚠️ ${limitCheck.error.message}`);
          return;
        }

        if (saveDecision.action === 'overwrite' && existingMock?.filePath) {
          fs.writeFileSync(existingMock.filePath, JSON.stringify(mockData, null, 2));
          logger.info(
            `[Mockifyer] Refreshed passthrough mock: ${currentScenario}/${existingMock.filename}`
          );
        } else {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const urlParts = (response.config.url || '').replace(/https?:\/\//, '').split('/');
          const domain = urlParts[0].replace(/\./g, '_');
          const urlPathPart = urlParts.slice(1).join('_') || 'root';
          const filename = `${timestamp}_${response.config.method?.toUpperCase() || 'GET'}_${domain}_${urlPathPart}.json`;
          const filePath = path.join(scenarioPath, filename);
          fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
          logger.info(`[Mockifyer] Saved new mock to file: ${currentScenario}/${filename}`);
        }

        if (this.config.generateTests?.enabled && this.testGenerator) {
          await this.generateTestForMock(mockData);
        }
      } else {
        console.warn('[Mockifyer] Cannot save mock: no database provider and fs/path not available');
      }
    } finally {
      this.savingResponses.delete(requestKey);
    }
  }

  private async persistMatchedMockAfterLiveCapture(
    cachedMock: CachedMockData,
    capturedResponse: StoredResponse,
    durationMs?: number
  ): Promise<void> {
    const updated = buildMockDataAfterLiveCapture(cachedMock.mockData, capturedResponse, durationMs);

    if (this.databaseProvider) {
      await this.databaseProvider.save(updated);
      return;
    }

    if (fs && cachedMock.filePath) {
      fs.writeFileSync(cachedMock.filePath, JSON.stringify(updated, null, 2));
      logger.info(`[Mockifyer-Fetch] Refreshed mock from live API: ${cachedMock.filename}`);
    }
  }

  /**
   * Simple path resolution fallback for React Native (when path module is stubbed)
   */
  private resolvePath(...parts: string[]): string {
    if (path && typeof path.resolve === 'function') {
      return path.resolve(...parts);
    }
    // Fallback: simple string-based path resolution
    const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : '.';
    const joined = parts
      .filter(p => p)
      .join('/')
      .replace(/\/+/g, '/')
      .replace(/^\.\//, '');
    
    if (joined.startsWith('/')) {
      return joined;
    }
    return `${cwd}/${joined}`.replace(/\/+/g, '/');
  }

  /**
   * Simple dirname fallback for React Native (when path module is stubbed)
   */
  private dirname(filePath: string): string {
    if (path && typeof path.dirname === 'function') {
      return path.dirname(filePath);
    }
    // Fallback: extract directory from path string
    const lastSlash = filePath.lastIndexOf('/');
    if (lastSlash <= 0) {
      return '.';
    }
    return filePath.substring(0, lastSlash);
  }

  /**
   * Generates test file for a mock
   */
  private async generateTestForMock(mockData: MockData): Promise<void> {
    if (!this.testGenerator) {
      return;
    }
    
    // Check if fs is available for writing test files
    // In React Native runtime, fs is not available, but in Metro bundler (Node.js) it should be
    // Try to require it dynamically if not already available
    let testFs = fs;
    
    if (!testFs) {
      try {
        testFs = require('fs');
      } catch (e) {
        return;
      }
    }
    
    // Use the available fs - ensure it's defined and has required methods
    if (!testFs || typeof testFs.writeFileSync !== 'function' || typeof testFs.mkdirSync !== 'function') {
      return;
    }
    
    const fsToUse = testFs;

    try {
      const options: TestGenerationOptions = {
        framework: this.config.generateTests?.framework || 'jest',
        outputPath: this.config.generateTests?.outputPath || './tests/generated',
        testPattern: this.config.generateTests?.testPattern || '{endpoint}.test.ts',
        includeSetup: this.config.generateTests?.includeSetup !== false,
        groupBy: this.config.generateTests?.groupBy || 'file',
        httpClientType: 'fetch'
      };

      const testCode = this.testGenerator.generateTest(mockData, options);
      const testFilePath = this.testGenerator.determineTestFilePath(mockData, options);
      
      // Resolve to absolute path (relative to process.cwd() which should be project root in Metro)
      // Use our fallback path resolution that works even when path module is stubbed
      const absoluteTestPath = this.resolvePath(testFilePath);
      
      // Ensure test directory exists
      const testDir = this.dirname(absoluteTestPath);
      
      if (!fsToUse.existsSync(testDir)) {
        fsToUse.mkdirSync(testDir, { recursive: true });
      }

      // Check if test file already exists
      if (fsToUse.existsSync(absoluteTestPath)) {
        // Extract test info to check if test already exists
        const testInfo = this.testGenerator.analyzeMock(mockData, 'fetch');
        const testName = this.generateTestNameFromInfo(testInfo);
        
        // Check if test already exists
        const existingContent = fsToUse.readFileSync(absoluteTestPath, 'utf-8');
        if (existingContent.includes(`it('${testName}'`) || existingContent.includes(`it("${testName}"`)) {
          return;
        }
        
        // Extract test code without imports and describe wrapper
        const testMatch = testCode.match(/it\('.*?', async \(\) => \{[\s\S]*?\}\);?/);
        if (testMatch) {
          // Append test to existing describe block
          const newTest = testMatch[0];
          const updatedContent = existingContent.replace(
            /(\s+)(\}\);?\s*)$/,
            `$1${newTest}\n$1$2`
          );
          fsToUse.writeFileSync(absoluteTestPath, updatedContent);
        }
      } else {
        // Create new test file
        fsToUse.writeFileSync(absoluteTestPath, testCode);
      }
    } catch (error: any) {
      logger.error('[Mockifyer] ❌ Error generating test:', error);
      logger.error('[Mockifyer] ❌ Error stack:', error?.stack);
      logger.error('[Mockifyer] ❌ Error message:', error?.message);
      // Don't throw - test generation failure shouldn't break mock saving
    }
  }

  /**
   * Helper to generate test name from test info
   */
  private generateTestNameFromInfo(testInfo: any): string {
    const method = testInfo.method.toUpperCase();
    const endpoint = testInfo.endpoint;
    
    if (testInfo.isGraphQL && testInfo.graphQLQuery) {
      const operationMatch = testInfo.graphQLQuery.match(/(?:query|mutation|subscription)\s+(\w+)/);
      if (operationMatch) {
        return `should execute ${operationMatch[1]} query`;
      }
      return 'should execute GraphQL query';
    }
    
    return `should ${method} ${endpoint}`;
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

  getHTTPClient(): HTTPClient {
    return this.httpClient;
  }

  async reloadMockData(syncFromProject: boolean = true): Promise<void> {
    await this.databaseProviderInitPromise;
    // If provider has a reload method, use it (for ExpoFileSystemProvider with caching)
    // For HybridProvider, this will also sync files from project folder to device
    if (this.databaseProvider && typeof (this.databaseProvider as any).reload === 'function') {
      if (syncFromProject && typeof (this.databaseProvider as any).reload === 'function') {
        // Pass syncFromProject flag if provider supports it (HybridProvider)
        await (this.databaseProvider as any).reload(syncFromProject);
      } else {
        await (this.databaseProvider as any).reload();
      }
    } else {
      // Fallback: try to load mock data if method exists
      if (typeof (this as any).loadMockData === 'function') {
        (this as any).loadMockData();
      }
    }
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

export interface MockifyerInstance extends HTTPClient {
  reloadMockData: (syncFromProject?: boolean) => Promise<void>;
  clearStaleCacheEntries: () => number;
  clearAllMocks: () => Promise<void>;
  setClientId: (lane: string) => void;
  getClientId: () => string | undefined;
}

export function setupMockifyer(config: MockifyerConfig): MockifyerInstance {
  installNodeInboundRequestCorrelationCapture();
  const resolvedConfig = applyProxyRecordOnMissEnv(config);
  // Initialize logger with config level (default to 'info' if not specified)
  setLogLevel(resolvedConfig.logging || 'info');
  
  // Set environment variables for Metro middleware to read test generation config
  // This allows Metro middleware (which runs in Node.js) to generate tests
  // when Hybrid Provider saves mocks via Metro endpoint
  if (config.generateTests?.enabled) {
    process.env.MOCKIFYER_GENERATE_TESTS = 'true';
    if (config.generateTests.framework) {
      process.env.MOCKIFYER_TEST_FRAMEWORK = config.generateTests.framework;
    }
    if (config.generateTests.outputPath) {
      process.env.MOCKIFYER_TEST_OUTPUT_PATH = config.generateTests.outputPath;
    }
    if (config.generateTests.testPattern) {
      process.env.MOCKIFYER_TEST_PATTERN = config.generateTests.testPattern;
    }
    if (config.generateTests.includeSetup === false) {
      process.env.MOCKIFYER_TEST_INCLUDE_SETUP = 'false';
    }
    if (config.generateTests.groupBy) {
      process.env.MOCKIFYER_TEST_GROUP_BY = config.generateTests.groupBy;
    }
    if (config.generateTests.uniqueTestsPerEndpoint) {
      process.env.MOCKIFYER_UNIQUE_TESTS_PER_ENDPOINT = 'true';
    }
  }
  
  initializeDateManipulation(resolvedConfig);
  initializeScenario(resolvedConfig);


  const mockifyer = new MockifyerClass(resolvedConfig);
  const httpClient = mockifyer.getHTTPClient();
  
  // Always store original fetch (even if not patching global)
  let originalFetch: typeof fetch;
  if ((global as any).__mockifyer_original_fetch) {
    originalFetch = (global as any).__mockifyer_original_fetch;
  } else {
    originalFetch = global.fetch;
    (global as any).__mockifyer_original_fetch = originalFetch;
  }
  
  const fetchClient = httpClient as any;
  if (fetchClient && typeof fetchClient.performRequest === 'function') {
    fetchClient._originalFetch = originalFetch;
  }
  
  // Patch global fetch if useGlobalFetch is true
  if (resolvedConfig.useGlobalFetch) {
    const mockifyerInstance = mockifyer;
    const originalFetchForPatched = (global as any).__mockifyer_original_fetch || originalFetch;
    
    global.fetch = async function(input: string | Request | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || 'GET';
      const headers = init?.headers || {};
      const body = init?.body;
      
      // Skip Mockifyer sync endpoints and Resend API to prevent infinite loops
      if (url.includes('/mockifyer-save') || url.includes('/mockifyer-clear') || url.includes('/mockifyer-sync') || url.includes('api.resend.com')) {
        return await originalFetchForPatched(input, init);
      }
      
      const simpleRequestKey = `${method}:${url}`;
      const isProcessing = (mockifyerInstance as any).processingRequests?.has(simpleRequestKey);
      if (isProcessing) {
        return await originalFetchForPatched(input, init);
      }
      
      let params: Record<string, string> | undefined = undefined;
      let baseUrl = url;
      try {
        const urlObj = new URL(url);
        if (urlObj.search) {
          params = {};
          urlObj.searchParams.forEach((value, key) => {
            params![key] = value;
          });
          urlObj.search = '';
          baseUrl = urlObj.toString();
        }
      } catch (error) {
        // URL parsing failed, use URL as-is
      }
      
      let headersObj: Record<string, string> = {};
      if (headers instanceof Headers) {
        headers.forEach((value, key) => {
          headersObj[key] = value;
        });
      } else if (Array.isArray(headers)) {
        headers.forEach(([key, value]) => {
          headersObj[key] = value;
        });
      } else {
        headersObj = headers as Record<string, string>;
      }
      
      try {
        const requestConfig = {
          url: baseUrl,
          method: method as any,
          headers: headersObj,
          params: params,
          data: body ? (typeof body === 'string' ? (body.startsWith('{') || body.startsWith('[') ? JSON.parse(body) : body) : body) : undefined
        };
        
        const response = await httpClient.request(requestConfig);
        
        const responseHeaders = new Headers();
        // Copy all headers from response, ensuring x-mockifyer header is included if present
        if (response.headers) {
          Object.entries(response.headers).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              responseHeaders.set(key, String(value));
            }
          });
        }
        
        const responseBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        
        return new Response(responseBody, {
          status: response.status,
          statusText: response.statusText || '',
          headers: responseHeaders
        });
      } catch (error: any) {
        if (error.response) {
          const responseHeaders = new Headers();
          Object.entries(error.response.headers || {}).forEach(([key, value]) => {
            responseHeaders.set(key, String(value));
          });
          
          const errorBody = typeof error.response.data === 'string' 
            ? error.response.data 
            : JSON.stringify(error.response.data);
          
          return new Response(errorBody, {
            status: error.response.status,
            statusText: error.response.statusText || '',
            headers: responseHeaders
          });
        }
        throw error;
      }
    } as typeof fetch;
  }
  
  const extendedClient = httpClient as MockifyerInstance;
  extendedClient.reloadMockData = async (syncFromProject?: boolean) =>
    await mockifyer.reloadMockData(syncFromProject);
  extendedClient.clearStaleCacheEntries = () => mockifyer.clearStaleCacheEntries();
  extendedClient.clearAllMocks = () => mockifyer.clearAllMocks();
  extendedClient.setClientId = (lane: string) => mockifyer.setClientId(lane);
  extendedClient.getClientId = () => mockifyer.getClientId();

  registerMockifyerInstance(extendedClient);

  return extendedClient;
}

/** Drops `proxy` when merging partial config so filesystem fallback cannot accidentally keep proxy. */
function omitProxyFromPartialConfig(config: Partial<MockifyerConfig>): Partial<MockifyerConfig> {
  const { proxy: _drop, ...rest } = config;
  void _drop;
  return rest;
}

/** Options for {@link initMockifyerForDashboardProxy} — dashboard + `/api/proxy` (run `mockifyer-dashboard --provider redis`). */
export interface InitMockifyerForDashboardProxyOptions {
  /** mockifyer-dashboard origin (e.g. `http://localhost:3002`). Not the Redis URL. */
  dashboardBaseUrl: string;
  /** Mock root for scenario file fallbacks etc. Defaults `MOCKIFYER_PATH` env or `./mock-data`. */
  mockDataPath?: string;
  /** Client lane id (`X-Mockifyer-Client-Id` / proxy envelope). Defaults `MOCKIFYER_CLIENT_ID` env. */
  clientId?: string;
  deviceId?: string;
  scenario?: string;
  /**
   * When **`true`**, each `/api/proxy` request sends **`"record": true`**. When **`false`**, sends **`"record": false`**.
   * When **omitted**, the **`record`** field is omitted so the **dashboard per-scenario** toggle applies; **`MOCKIFYER_PROXY_RECORD_ON_MISS`**
   * and **`MOCKIFYER_RECORD=true`** (last) still set an explicit client flag when you want env-driven recording without code.
   */
  recordOnMiss?: boolean;
  /**
   * When false, dashboard proxy stores request-only stubs on cache miss.
   * Defaults via {@link resolveRecordResponses} (`MOCKIFYER_RECORD_RESPONSES` env, else `false`).
   */
  recordResponses?: boolean;
  strictLaneScenario?: boolean;
  useGlobalFetch?: boolean;
  /** Use a local provider for mock hits before the proxy (default in-memory only) when **`/api/proxy`** is active. */
  databaseProvider?: MockifyerConfig['databaseProvider'];
  /** Additional `MockifyerConfig` fields — applied first, then preset fields win on `mockDataPath`, `proxy`, etc. */
  config?: Partial<MockifyerConfig>;
  /**
   * When **`true`**, skips **`GET …/api/health`** and always sets **`proxy`**.
   * Default **`false`**: if Redis is not healthy (or unreachable), omit **`proxy`** and use filesystem mocks + **`recordMode`** disk saves — aligns with **`setupMockifyerForReactNative`** dev fallback.
   */
  skipDashboardRedisHealthCheck?: boolean;
  /**
   * When the proxy records a response to Redis, also write the same mock under `mockDataPath` on this machine
   * (or via Metro when using strict RN + in-memory). Env: `MOCKIFYER_PROXY_MIRROR_TO_CLIENT`.
   */
  mirrorRecordedMocksToClient?: boolean;
}

/**
 * Preset: **`GET /api/health`** must report Redis ready before **`proxy`** is set; otherwise filesystem mocks without proxy (like RN Hybrid fallback vs strict proxy).
 * Run **`mockifyer-dashboard --provider redis`** for the dashboard hop; use **`skipDashboardRedisHealthCheck`** to bypass the probe.
 *
 * For full control, use {@link setupMockifyer} directly.
 */
export async function initMockifyerForDashboardProxy(
  options: InitMockifyerForDashboardProxyOptions
): Promise<MockifyerInstance> {
  const extra = options.config ?? {};
  const dashboardBaseUrl = String(options.dashboardBaseUrl).trim();
  if (!dashboardBaseUrl) {
    throw new Error('initMockifyerForDashboardProxy: dashboardBaseUrl is required');
  }

  const mockDataPath =
    options.mockDataPath ??
    extra.mockDataPath ??
    (typeof process !== 'undefined' && process.env?.MOCKIFYER_PATH
      ? process.env.MOCKIFYER_PATH
      : './mock-data');

  const envRecord =
    typeof process !== 'undefined' && process.env?.MOCKIFYER_RECORD === 'true';

  const recordOnMiss =
    options.recordOnMiss ??
    extra.proxy?.recordOnMiss ??
    parseProxyRecordOnMissEnv() ??
    (envRecord ? true : undefined);

  const recordResponses = resolveRecordResponses(
    options.recordResponses ?? extra.proxy?.recordResponses
  );

  const useRedisProxy =
    options.skipDashboardRedisHealthCheck === true ||
    (await canUseDashboardRedisProxy(dashboardBaseUrl));

  if (!useRedisProxy) {
    const strictProxyOnly = resolveStrictScenarioResolution({
      strictScenarioResolution:
        options.config?.strictScenarioResolution ?? extra.strictScenarioResolution,
    });
    logger.warn(
      `[Mockifyer] initMockifyerForDashboardProxy: "${dashboardBaseUrl}" did not report healthy Redis ` +
        (strictProxyOnly
          ? '(strict proxy-only — local recording disabled). '
          : '(unreachable or non-Redis provider). Falling back to filesystem mocks without proxy. ') +
        'Set skipDashboardRedisHealthCheck: true to force proxy anyway.'
    );
    const stripped = omitProxyFromPartialConfig(extra);
    const fallbackDb = options.databaseProvider ?? extra.databaseProvider;
    const mergedInitLogFs: MockifyerConfig['initLog'] = {
      ...stripped.initLog,
      headline:
        stripped.initLog?.headline ??
        (strictProxyOnly
          ? '[Mockifyer preset] Node · strict proxy-only (dashboard Redis health check failed)'
          : '[Mockifyer preset] Node · filesystem (dashboard Redis health check failed)'),
    };
    return setupMockifyer({
      ...stripped,
      mockDataPath,
      ...(fallbackDb !== undefined ? { databaseProvider: fallbackDb } : {}),
      ...(strictProxyOnly ? { intendedProxyBaseUrl: dashboardBaseUrl.trim() } : {}),
      useGlobalFetch: options.useGlobalFetch ?? extra.useGlobalFetch ?? true,
      clientId: options.clientId ?? extra.clientId,
      deviceId: options.deviceId ?? extra.deviceId,
      initLog: mergedInitLogFs,
    });
  }

  const upstreamProxy = extra.proxy as MockifyerConfig['proxy'] | undefined;
  const mergedProxy = {
    ...upstreamProxy,
    baseUrl: upstreamProxy?.baseUrl ?? dashboardBaseUrl,
    scenario:
      options.scenario ??
      upstreamProxy?.scenario ??
      (typeof process !== 'undefined' && process.env?.MOCKIFYER_SCENARIO?.trim()
        ? process.env.MOCKIFYER_SCENARIO.trim()
        : undefined),
    ...(typeof recordOnMiss === 'boolean' ? { recordOnMiss } : {}),
    recordResponses,
  } as NonNullable<MockifyerConfig['proxy']>;
  if (
    options.strictLaneScenario !== undefined ||
    upstreamProxy?.strictLaneScenario !== undefined
  ) {
    mergedProxy.strictLaneScenario =
      options.strictLaneScenario ?? upstreamProxy?.strictLaneScenario;
  }

  const envMirrorRaw =
    typeof process !== 'undefined'
      ? String(process.env?.MOCKIFYER_PROXY_MIRROR_TO_CLIENT || '').trim().toLowerCase()
      : '';
  const envMirror =
    envMirrorRaw === '1' || envMirrorRaw === 'true' || envMirrorRaw === 'yes' || envMirrorRaw === 'on';
  const mirrorRecordedMocksToClient =
    options.mirrorRecordedMocksToClient ??
    extra.proxy?.mirrorRecordedMocksToClient ??
    (envMirror ? true : undefined);
  if (mirrorRecordedMocksToClient !== undefined) {
    mergedProxy.mirrorRecordedMocksToClient = mirrorRecordedMocksToClient;
  }

  const mergedInitLogProxy: MockifyerConfig['initLog'] = {
    ...extra.initLog,
    headline: extra.initLog?.headline ?? '[Mockifyer preset] Node · dashboard Redis proxy',
  };

  const strictScenarioResolution =
    extra.strictScenarioResolution ??
    options.config?.strictScenarioResolution ??
    true;

  return setupMockifyer({
    ...extra,
    mockDataPath,
    strictScenarioResolution,
    databaseProvider: options.databaseProvider ?? extra.databaseProvider ?? { type: 'memory' },
    useGlobalFetch: options.useGlobalFetch ?? extra.useGlobalFetch ?? true,
    clientId: options.clientId ?? extra.clientId,
    deviceId: options.deviceId ?? extra.deviceId,
    proxy: mergedProxy,
    initLog: mergedInitLogProxy,
  });
}

export interface InitMockifyerForLocalFilesystemOptions {
  mockDataPath?: string;
  useGlobalFetch?: boolean;
  recordMode?: boolean;
  /** Applied first; preset fills `mockDataPath` / `useGlobalFetch` when omitted. */
  config?: Partial<MockifyerConfig>;
}

/**
 * Preset: local **filesystem** mocks under {@link InitMockifyerForLocalFilesystemOptions.mockDataPath}
 * (default `./mock-data` or `MOCKIFYER_PATH`). No dashboard proxy.
 */
export function initMockifyerForLocalFilesystem(
  options: InitMockifyerForLocalFilesystemOptions = {}
): MockifyerInstance {
  const extra = options.config ?? {};
  const mockDataPath =
    options.mockDataPath ??
    extra.mockDataPath ??
    (typeof process !== 'undefined' && process.env?.MOCKIFYER_PATH
      ? process.env.MOCKIFYER_PATH
      : './mock-data');

  return setupMockifyer({
    ...extra,
    mockDataPath,
    useGlobalFetch: options.useGlobalFetch ?? extra.useGlobalFetch ?? true,
    recordMode: options.recordMode ?? extra.recordMode ?? false,
  });
}

/** Shared with {@link setupMockifyerForReactNative} strict-proxy branching. */
export { canUseDashboardRedisProxy } from './utils/dashboard-redis-health';

// Re-export types from core
export * from '@sgedda/mockifyer-core';

// Export React Native helpers
export * from './react-native';

