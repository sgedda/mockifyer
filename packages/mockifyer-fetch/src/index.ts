// Fetch-only Mockifyer implementation
// fs and path are lazy-loaded via dynamic require to avoid breaking browser bundles
//
// DO NOT change this to static require() or import - bundlers will fail on browser builds.
// The dynamic require is hidden inside functions to prevent bundle-time resolution.

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
  scheduleRuntimeDateSyncFromConfig,
  DatabaseProvider,
  createProvider,
  initializeScenario,
  isScenarioLaunchFromNativeArguments,
  TestGenerator,
  TestGenerationOptions,
  checkRequestLimit,
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
  registerMockifyerInstance,
  ensureOverrideGroupRuntimeForScenarioPath,
  logMockifyerInitSummary,
  tryGetClientIdFromLaunchArguments,
  MOCKIFYER_LAUNCH_ARGUMENT_CLIENT_ID_KEY,
  resolveActivationMode,
  shouldApplyMockifyer,
  isExplicitProxyScenarioContext,
  newRecordingUsesAlwaysUseRealApi,
  shouldBlockLocalMockRecording,
  resolveStrictScenarioResolution,
  type MockifyerActivationMode,
  emitMockifyerNetworkEvent,
  networkEventHashFromRequestKey,
  recordInlineTraceHopFromExchange,
  unwrapAndMergeInlineTraceEnvelope,
  unwrapInlineTraceEnvelopeEmittingNetworkEvents,
  resolveNetworkLogIncludeTraceOptions,
  resolveNetworkLogIncludeTraceOptionsAsync,
  getInlineTraceEnvelopeBusinessBody,
  resolveRecordResponses,
  resolveLocalRecordResponses,
  buildLocalRecordingMockData,
  applyOutboundRequestCorrelation,
  adoptStoredOutboundRequestId,
  resolvePersistedHopIds,
  applyPersistedHopIds,
  ensureLocalInboundParentStubSaved,
  inboundParentStubFilename,
  readOutboundParentHopFromConfig,
  getActiveInboundRequest,
  attachMockifyerRequestIdToError,
  resolveMockifyerRequestIdForError,
  configureFlightRecorder,
  resolveFlightRecorderConfig,
  setFlightRecorderRuntimeContext,
  configureAtlas,
  resolveActiveMockifyerSessionId,
  type RequestCorrelationContext,
  DomainPathRulesSession,
  installNodeInboundRequestCorrelationCapture,
  stripMockifyerTraceFromBody,
  resolveInitialRuntimeEnabled,
  resolveRuntimeEnabledStorage,
  savePersistedRuntimeEnabled,
  type MockifyerRuntimeEnabledStorage,
  outboundHeadersToRecord,
  appendParamsToUrl,
  getMockFilePath,
  formatDateStr,
  getCurrentDate,
  isMockRecordingSidecarDir,
} from '@sgedda/mockifyer-core';
import { logger, setLogLevel } from '@sgedda/mockifyer-core';
import {
  applyProxyRecordOnMissEnv,
  mirrorProxyRecordingToClient,
  initMockifyerForDashboardProxy as coreInitMockifyerForDashboardProxy,
  initMockifyerForLocalFilesystem as coreInitMockifyerForLocalFilesystem,
  initMockifyerForDashboardProxyClients,
  initMockifyerForLocalFilesystemClients,
  resolveClientInitFlags,
  needsSiblingClientSetup,
  pickPrimaryDualMockifyerInstance,
  loadAxiosSetupMockifyer,
  type InitMockifyerForDashboardProxyOptions,
  type InitMockifyerForLocalFilesystemOptions,
} from './core-proxy';
import { resolveProxyUpstreamTlsInsecure } from '@sgedda/mockifyer-core/utils/proxy-upstream-tls-insecure';

import { FetchHTTPClient } from './clients/fetch-client';
import { bodyInitForFetchResponse } from './utils/fetch-response-body';
import { resolvePatchedFetchRequest } from './utils/resolve-patched-fetch-request';
import { NodeCapabilities } from './node-capabilities';
import { MockifyerClass } from './mockifyer-class';

export interface MockifyerInstance extends HTTPClient {
  reloadMockData: (syncFromProject?: boolean) => Promise<void>;
  clearStaleCacheEntries: () => number;
  clearAllMocks: () => Promise<void>;
  setClientId: (lane: string) => void;
  getClientId: () => string | undefined;
  setRecordMode: (enabled: boolean) => void;
  isRecordMode: () => boolean;
  setRecordResponses: (enabled: boolean) => void;
  isRecordResponses: () => boolean;
  enableMockifyer: () => void;
  disableMockifyer: () => void;
  isMockifyerEnabled: () => boolean;
}

export function setupMockifyer(config: MockifyerConfig): MockifyerInstance {
  // Node-only inbound capture; safe on RN (no-op when not on Node).
  if (typeof installNodeInboundRequestCorrelationCapture === 'function') {
    installNodeInboundRequestCorrelationCapture();
  }
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
  scheduleRuntimeDateSyncFromConfig(resolvedConfig);


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
      // Disabled means the real network: do not rebuild the call. The interceptor
      // bypass flag still runs FetchHTTPClient, which JSON.parses `{`/`[` bodies
      // (throwing on invalid JSON), JSON.stringifies FormData/Blob/URLSearchParams,
      // and drops credentials, abort signals, and Request-only method/headers/body.
      if (!mockifyerInstance.isMockifyerEnabled()) {
        return await originalFetchForPatched(input, init);
      }

      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      
      // Skip Mockifyer sync endpoints, dashboard plumbing, and Resend API
      if (
        containsMockifyerSyncEndpointMarker(url) ||
        url.includes('api.resend.com') ||
        isMockifyerDashboardPlumbingApiUrl(url)
      ) {
        return await originalFetchForPatched(input, init);
      }

      const resolved = await resolvePatchedFetchRequest(input, init);
      const method = resolved.method;
      
      const simpleRequestKey = `${method}:${resolved.url}`;
      const isProcessing = (mockifyerInstance as any).processingRequests?.has(simpleRequestKey);
      if (isProcessing) {
        return await originalFetchForPatched(input, init);
      }
      
      let params: Record<string, string> | undefined = undefined;
      let baseUrl = resolved.url;
      try {
        const urlObj = new URL(resolved.url);
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
      
      try {
        const requestConfig = {
          url: baseUrl,
          method: method as any,
          headers: resolved.headers,
          params: params,
          data: resolved.body
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
        
        return new Response(bodyInitForFetchResponse(response.status, response.data), {
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

          const errorStatus = error.response.status;
          return new Response(bodyInitForFetchResponse(errorStatus, error.response.data), {
            status: errorStatus,
            statusText: error.response.statusText || '',
            headers: responseHeaders
          });
        }
        throw attachMockifyerRequestIdToError(
          error,
          resolveMockifyerRequestIdForError({
            hopRequestId: (error as { config?: { __mockifyer_requestId?: string } })?.config
              ?.__mockifyer_requestId,
            responseHeaders: (error as { response?: { headers?: unknown } })?.response?.headers,
          })
        );
      }
    } as typeof fetch;

    logger.info('[Mockifyer] ✅ Patched global fetch (useGlobalFetch: true)');
  }
  
  const extendedClient = httpClient as MockifyerInstance;
  extendedClient.reloadMockData = async (syncFromProject?: boolean) =>
    await mockifyer.reloadMockData(syncFromProject);
  extendedClient.clearStaleCacheEntries = () => mockifyer.clearStaleCacheEntries();
  extendedClient.clearAllMocks = () => mockifyer.clearAllMocks();
  extendedClient.setClientId = (lane: string) => mockifyer.setClientId(lane);
  extendedClient.getClientId = () => mockifyer.getClientId();
  extendedClient.setRecordMode = (enabled: boolean) => mockifyer.setRecordMode(enabled);
  extendedClient.isRecordMode = () => mockifyer.isRecordMode();
  extendedClient.setRecordResponses = (enabled: boolean) => mockifyer.setRecordResponses(enabled);
  extendedClient.isRecordResponses = () => mockifyer.isRecordResponses();
  extendedClient.enableMockifyer = () => mockifyer.enableMockifyer();
  extendedClient.disableMockifyer = () => mockifyer.disableMockifyer();
  extendedClient.isMockifyerEnabled = () => mockifyer.isMockifyerEnabled();

  registerMockifyerInstance(extendedClient);

  return extendedClient;
}

export type { InitMockifyerForDashboardProxyOptions, InitMockifyerForLocalFilesystemOptions };

/**
 * Preset: dashboard central store proxy when health check passes; otherwise filesystem mocks.
 * Set both `useGlobalFetch` and `useGlobalAxios` to patch fetch and axios in one call
 * (requires `@sgedda/mockifyer-axios` when axios is enabled).
 * For full control, use {@link setupMockifyer} directly.
 */
export async function initMockifyerForDashboardProxy(
  options: InitMockifyerForDashboardProxyOptions
): Promise<MockifyerInstance> {
  const flags = resolveClientInitFlags(options, {
    useGlobalFetch: true,
    useGlobalAxios: false,
  });

  if (!needsSiblingClientSetup('fetch', flags)) {
    return coreInitMockifyerForDashboardProxy(
      { ...options, useGlobalFetch: flags.useFetch, useGlobalAxios: false },
      setupMockifyer
    );
  }

  const result = await initMockifyerForDashboardProxyClients(
    options,
    {
      ...(flags.useFetch ? { fetch: setupMockifyer } : {}),
      ...(flags.useAxios
        ? { axios: loadAxiosSetupMockifyer() as typeof setupMockifyer }
        : {}),
    },
    flags
  );

  return pickPrimaryDualMockifyerInstance('fetch', flags, result);
}

/**
 * Preset: local filesystem mocks. No dashboard proxy.
 * Set both `useGlobalFetch` and `useGlobalAxios` to patch both clients in one call.
 */
export function initMockifyerForLocalFilesystem(
  options: InitMockifyerForLocalFilesystemOptions = {}
): MockifyerInstance {
  const flags = resolveClientInitFlags(options, {
    useGlobalFetch: true,
    useGlobalAxios: false,
  });

  if (!needsSiblingClientSetup('fetch', flags)) {
    return coreInitMockifyerForLocalFilesystem(
      { ...options, useGlobalFetch: flags.useFetch, useGlobalAxios: false },
      setupMockifyer
    );
  }

  const result = initMockifyerForLocalFilesystemClients(
    options,
    {
      ...(flags.useFetch ? { fetch: setupMockifyer } : {}),
      ...(flags.useAxios
        ? { axios: loadAxiosSetupMockifyer() as typeof setupMockifyer }
        : {}),
    },
    flags
  );

  return pickPrimaryDualMockifyerInstance('fetch', flags, result);
}

/** Shared with {@link setupMockifyerForReactNative} strict-proxy branching. */
export {
  canUseDashboardRedisProxy,
  canUseDashboardCentralProxy,
} from './utils/dashboard-redis-health';

// Export MockifyerClass for browser/RN entries to use with capabilities
export { MockifyerClass };

// Re-export types from core
export * from '@sgedda/mockifyer-core';

// React Native helpers: import `@sgedda/mockifyer-fetch/react-native` (not this entry — avoids
// pulling optional `react-native-launch-arguments` into Node/Next webpack bundles).

