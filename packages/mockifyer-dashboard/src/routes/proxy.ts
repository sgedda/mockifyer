import express, { Request, Response } from 'express';
import { getDashboardContext, resolveRedisDiskMirrorOptions } from '../utils/dashboard-context';
import { createDashboardMockStore } from '../utils/create-dashboard-mock-store';
import { supportsDashboardProxy } from '../utils/dashboard-provider';
import { RedisMockStore } from '../utils/redis-mock-store';
import {
  findMockOnDiskByRequestHash,
  mirrorRecordedMockToDisk,
  mirroredMockRelativePath,
} from '../utils/redis-disk-mirror';
import {
  generateRequestKey,
  getCurrentDate,
  resolveExplicitDateManipulation,
  MOCKIFYER_CLIENT_ID_HEADER,
  MOCKIFYER_REQUEST_ID_HEADER,
  prepareMockResponseBody,
  parseRecordingExclusionsEnv,
  shouldExcludeRecording,
  mockShouldServeStoredBody,
  buildClientResponseFromLiveCapture,
  buildMockDataAfterLiveCapture,
  resolveShouldPersistLiveCapture,
  resolveMockReplayMode,
  mockRequiresUpstreamFetch,
  resolveRecordNewMocksAsPassthrough,
  resolveRefreshPassthroughRecordings,
  applyRecordingPassthroughFlag,
  buildRequestOnlyMockData,
  applyCapturedResponse,
  mockHasCapturableResponse,
  resolveRecordResponsesForRequest,
  toNetworkLogBodyPreview,
  buildProxyUpstreamBodyInit,
  normalizeProxyBodyForRequestKey,
  resolveProxyUpstreamTlsInsecureForRequest,
  createServeTimePoolResponseLoader,
  isMockifyerDashboardPlumbingApiUrl,
  ensureOverrideGroupRuntimeForScenarioPath,
  resolveOverrideGroupIdForServe,
  MOCKIFYER_OVERRIDE_GROUP_HEADER,
  getScenarioFolderPath,
  buildInboundParentStubMock,
  inboundParentStubHash,
  type MockData,
} from '@sgedda/mockifyer-core';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fetchProxyUpstream } from '../utils/proxy-upstream-fetch';
import { shouldWriteNewProxyRecording } from '../utils/proxy-record-existing';
import { rewriteEmulatorLoopbackUrl } from '../utils/rewrite-emulator-loopback-url';
import { loadMergedOverrideGroupState } from '../utils/override-group-persist';
import {
  appendProxyNetworkEvent,
  applyProxyCorrelationToMockData,
  applyUpstreamRequestCorrelationHeaders,
  closeProxyNetworkLog,
  copyProxyUpstreamHeadersWithoutHopIds,
  openProxyNetworkLog,
  resolveNetworkLogScenario,
  resolveProxyInboundCorrelation,
  resolveProxyTraceIds,
  resolveProxyHopIdentity,
  applyHopIdentityToProxyLog,
} from '../utils/proxy-network-log';

const router = express.Router();

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function deriveFallbackDeviceId(req: Request): string | undefined {
  const ip = req.ip || '';
  const ua = typeof req.header('user-agent') === 'string' ? String(req.header('user-agent')) : '';
  const raw = `${ip}|${ua}`.trim();
  if (!raw || raw === '|') return undefined;
  return `derived:${sha256Hex(raw).slice(0, 16)}`;
}

function parseProxyParentHop(body: unknown): { method: string; url: string } | undefined {
  const raw = (body as { parentHop?: unknown } | null | undefined)?.parentHop;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const hop = raw as { method?: unknown; url?: unknown };
  const url = typeof hop.url === 'string' ? hop.url.trim() : '';
  if (!url) {
    return undefined;
  }
  const method =
    typeof hop.method === 'string' && hop.method.trim() ? hop.method.trim().toUpperCase() : 'GET';
  return { method, url };
}

/**
 * When children arrive with a parentRequestId that was never recorded (GraphQL hit the
 * BFF without a proxy write, concurrent race, etc.), upsert a request-only stub so hops
 * UI can show the entry instead of "Missing entry".
 */
async function ensureInboundParentStubInStore(
  store: ReturnType<typeof createDashboardMockStore>,
  scenarioName: string,
  parentRequestId: string | undefined | null,
  parentHop: { method: string; url: string } | undefined,
  debugProxy: boolean
): Promise<void> {
  const parentId = typeof parentRequestId === 'string' ? parentRequestId.trim() : '';
  if (!parentId || !parentHop?.url?.trim()) {
    return;
  }
  const stubHash = inboundParentStubHash(parentId);
  try {
    const existing = await store.getByHashInScenario(stubHash, scenarioName);
    if (existing?.requestId?.trim() === parentId) {
      return;
    }
    const stub = buildInboundParentStubMock(parentId, parentHop);
    await store.setByHashInScenario(stubHash, stub, scenarioName);
    if (debugProxy) {
      console.log(
        `[ProxyRoute] upserted inbound parent stub: ${parentHop.method} ${parentHop.url} (requestId=${parentId.slice(0, 8)}…)`
      );
    }
  } catch (err: any) {
    console.error(
      '[ProxyRoute] inbound parent stub upsert failed:',
      err?.message ?? err
    );
  }
}

function toRecordStringHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers || typeof headers !== 'object') return out;
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

function proxyNetworkBodyFields(requestBody?: unknown, responseBody?: unknown): {
  requestBodyPreview?: string;
  responseBodyPreview?: string;
} {
  const requestBodyPreview = toNetworkLogBodyPreview(requestBody);
  const responseBodyPreview = toNetworkLogBodyPreview(responseBody);
  return {
    ...(requestBodyPreview ? { requestBodyPreview } : {}),
    ...(responseBodyPreview ? { responseBodyPreview } : {}),
  };
}

function proxyTraceResponseFields(
  res: Response,
  networkLogCtx: Awaited<ReturnType<typeof openProxyNetworkLog>>,
  inbound: ReturnType<typeof resolveProxyInboundCorrelation>
): Record<string, string | null> {
  const trace = resolveProxyTraceIds(networkLogCtx, inbound);
  if (trace.requestId) {
    res.setHeader(MOCKIFYER_REQUEST_ID_HEADER, trace.requestId);
  }
  return trace;
}

router.post('/', async (req: Request, res: Response) => {
  const { mockDataPath, config } = getDashboardContext(req);
  const debugProxy = process.env.MOCKIFYER_PROXY_DEBUG === 'true';

  if (!supportsDashboardProxy(config.provider)) {
    return res.status(400).json({ error: "Proxy requires dashboard provider 'redis' or 'sqlite'." });
  }

  const {
    url: rawUrl,
    method,
    headers,
    body,
    scenario,
    record,
    recordResponses: recordResponsesFromBody,
    allowUpstream,
    clientId: clientIdFromBody,
    deviceId: deviceIdFromBody,
    strictLaneScenario: strictLaneScenarioFromBody,
    upstreamTlsInsecure: upstreamTlsInsecureFromBody,
    overrideGroup: overrideGroupFromBody,
  } = req.body || {};
  const parentHopFromBody = parseProxyParentHop(req.body);
  const requestStrictLane =
    typeof strictLaneScenarioFromBody === 'boolean' ? strictLaneScenarioFromBody : undefined;
  const upstreamTlsInsecure = resolveProxyUpstreamTlsInsecureForRequest(upstreamTlsInsecureFromBody);
  const clientIdFromHeader =
    typeof req.header('x-mockifyer-client-id') === 'string' ? String(req.header('x-mockifyer-client-id')) : undefined;
  const clientId = typeof clientIdFromBody === 'string' && clientIdFromBody.trim()
    ? clientIdFromBody.trim()
    : (clientIdFromHeader && clientIdFromHeader.trim() ? clientIdFromHeader.trim() : undefined);
  const overrideGroupFromHeader =
    typeof req.header(MOCKIFYER_OVERRIDE_GROUP_HEADER) === 'string'
      ? String(req.header(MOCKIFYER_OVERRIDE_GROUP_HEADER)).trim()
      : '';
  const explicitOverrideGroup =
    typeof overrideGroupFromBody === 'string' && overrideGroupFromBody.trim()
      ? overrideGroupFromBody.trim()
      : overrideGroupFromHeader || null;
  const deviceIdFromHeader =
    typeof req.header('x-mockifyer-device-id') === 'string' ? String(req.header('x-mockifyer-device-id')) : undefined;
  const deviceId =
    typeof deviceIdFromBody === 'string' && deviceIdFromBody.trim()
      ? deviceIdFromBody.trim()
      : deviceIdFromHeader && deviceIdFromHeader.trim()
        ? deviceIdFromHeader.trim()
        : deriveFallbackDeviceId(req);
  if (!rawUrl || typeof rawUrl !== 'string') return res.status(400).json({ error: 'url is required' });
  const url = rewriteEmulatorLoopbackUrl(rawUrl);
  if (debugProxy && url !== rawUrl) {
    console.log(`[ProxyRoute] rewrote emulator loopback host: ${rawUrl} → ${url}`);
  }

  const inboundCorrelation = resolveProxyInboundCorrelation(req, req.body);
  const upperMethod = String(method || 'GET').toUpperCase();
  // Provisional identity for the network log only — do not register yet so a later
  // stored-id adopt does not leave the fresh client mint as a second owner of this URL.
  let hopIdentity = resolveProxyHopIdentity(inboundCorrelation, upperMethod, url, undefined, {
    register: false,
  });
  const bodyScenario = typeof scenario === 'string' && scenario.trim() ? scenario.trim() : undefined;

  const normalizedRequestBody = normalizeProxyBodyForRequestKey(body);

  const storedRequest = {
    method: upperMethod,
    url,
    headers: toRecordStringHeaders(headers),
    data: normalizedRequestBody,
    queryParams: undefined as any,
  };

  const requestKey = generateRequestKey(storedRequest as any);
  const hash = sha256Hex(requestKey);

  const store = createDashboardMockStore(config, mockDataPath);

  const redisDisk = resolveRedisDiskMirrorOptions(config);
  let networkLogCtx: Awaited<ReturnType<typeof openProxyNetworkLog>> = null;

  try {
    if (clientId) {
      await store.recordLaneSeen(clientId).catch(() => undefined);
    }
    if (clientId && deviceId) await store.recordLaneDeviceSeen(clientId, deviceId).catch(() => undefined);

    const resolution = await store.resolveProxyScenario(bodyScenario, clientId, {
      strictLaneScenario: requestStrictLane,
    });

    if (resolution.scenario !== null) {
      await store
        .recordProxyEffectiveObservation({
          clientId: clientId || null,
          deviceId: deviceId || null,
          effectiveScenario: resolution.scenario,
          resolutionSource: resolution.resolutionSource,
          clientBodyScenarioOverride: resolution.hadBodyScenarioOverride,
        })
        .catch(() => undefined);
    }

    if (resolution.scenario === null) {
      const logScenario = resolveNetworkLogScenario(mockDataPath, null, bodyScenario);
      networkLogCtx = await openProxyNetworkLog(mockDataPath, config, logScenario, hopIdentity);

      const effectiveAllowUpstream = typeof allowUpstream === 'boolean' ? allowUpstream : true;
      if (debugProxy) {
        console.log(
          `[ProxyRoute] strict lane unresolved — upstream passthrough (no mocks): ${upperMethod} ${url} (lane=${clientId || '—'})`
        );
      }
      if (!effectiveAllowUpstream) {
        await appendProxyNetworkEvent(networkLogCtx, {
          method: upperMethod,
          url,
          clientId: clientId || null,
          deviceId: deviceId || null,
          source: 'blocked',
          status: 412,
          requestHash: hash,
          requestHeaders: toRecordStringHeaders(headers),
          ...proxyNetworkBodyFields(body),
          errorMessage: 'Strict lane scenario mode requires a dashboard mapping for this clientId.',
        });
        return res.status(412).json({
          proxied: false,
          source: 'blocked_strict_lane',
          hash,
          clientId: clientId || null,
          deviceId: deviceId || null,
          error: 'Strict lane scenario mode requires a dashboard mapping for this clientId.',
        });
      }
      const clientHeaderRecord = toRecordStringHeaders(headers);
      const upstreamHeaders = new Headers();
      copyProxyUpstreamHeadersWithoutHopIds(upstreamHeaders, clientHeaderRecord);
      if (clientId) {
        upstreamHeaders.set(MOCKIFYER_CLIENT_ID_HEADER, clientId);
      }

      const upstreamBody = buildProxyUpstreamBodyInit(body, clientHeaderRecord, upperMethod);
      const init: RequestInit = {
        method: upperMethod,
        headers: upstreamHeaders,
      };
      copyProxyUpstreamHeadersWithoutHopIds(upstreamHeaders, upstreamBody.headers);
      // Hop identity must win over any client/body header bag (always-refresh adopts stored id).
      applyUpstreamRequestCorrelationHeaders(upstreamHeaders, networkLogCtx ?? hopIdentity);
      if (upstreamBody.body !== undefined) {
        init.body = upstreamBody.body as RequestInit['body'];
      }

      const upstreamRes = await fetchProxyUpstream(url, init, upstreamTlsInsecure);
      const contentType = upstreamRes.headers.get('content-type') || '';
      const rawText = await upstreamRes.text();

      let data: any = rawText;
      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = rawText;
        }
      }

      const responseHeaders: Record<string, string> = {};
      upstreamRes.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const response = {
        status: upstreamRes.status,
        data,
        headers: responseHeaders,
      };

      await appendProxyNetworkEvent(networkLogCtx, {
        method: upperMethod,
        url,
        clientId: clientId || null,
        deviceId: deviceId || null,
        source: 'upstream',
        status: upstreamRes.status,
        requestHash: hash,
        requestHeaders: clientHeaderRecord,
        responseHeaders,
        ...proxyNetworkBodyFields(normalizedRequestBody, data),
      });
      return res.json({
        proxied: true,
        source: 'upstream_strict_lane_unresolved',
        hash,
        clientId: clientId || null,
        deviceId: deviceId || null,
        scenarioResolution: resolution,
        response,
        ...proxyTraceResponseFields(res, networkLogCtx, hopIdentity),
      });
    }

    const resolvedScenarioName = resolution.scenario;
    networkLogCtx = await openProxyNetworkLog(mockDataPath, config, resolvedScenarioName, hopIdentity);

    const proxyConfig = await store.getProxyConfig(resolvedScenarioName);
    let effectiveRecord = typeof record === 'boolean' ? record : proxyConfig?.recordOnMiss ?? true;
    const proxyRecordingExclusions = parseRecordingExclusionsEnv();
    if (
      effectiveRecord &&
      typeof url === 'string' &&
      (isMockifyerDashboardPlumbingApiUrl(url) ||
        (proxyRecordingExclusions.length > 0 && shouldExcludeRecording(url, proxyRecordingExclusions)))
    ) {
      effectiveRecord = false;
    }
    const effectiveAllowUpstream =
      typeof allowUpstream === 'boolean' ? allowUpstream : proxyConfig?.allowUpstream ?? true;

    const redisDateDoc = await store.getDateConfig(resolvedScenarioName);
    const laneDateDoc = clientId ? await store.getLaneDateConfig(clientId).catch(() => null) : null;
    const getNow = () =>
      getCurrentDate({
        mockDataPath,
        scenario: resolvedScenarioName,
        explicitManipulation: resolveExplicitDateManipulation({
          laneManipulation: laneDateDoc?.dateManipulation ?? null,
          scenarioDateDoc: redisDateDoc,
        }),
      });

    let mock = await store.getByHashInScenario(hash, resolvedScenarioName);
    let mockSource: 'redis' | 'disk' = 'redis';
    let mockFilename = mirroredMockRelativePath(hash);

    const scenarioPath = getScenarioFolderPath(mockDataPath, resolvedScenarioName);
    const laneOverrideGroup = clientId
      ? await store.getLaneOverrideGroup(clientId).catch(() => null)
      : null;
    const mergedGroups = await loadMergedOverrideGroupState(
      store,
      resolvedScenarioName,
      scenarioPath
    );
    const overrideGroupHydrate = {
      clientId,
      explicitGroupId: explicitOverrideGroup,
      laneGroupId: laneOverrideGroup,
      groups: mergedGroups.groups,
      defaultGroupId: mergedGroups.defaultGroup,
    };
    const overrideGroupId = resolveOverrideGroupIdForServe(scenarioPath, overrideGroupHydrate);
    ensureOverrideGroupRuntimeForScenarioPath(scenarioPath, overrideGroupHydrate);

    if (!mock && redisDisk.readFallback) {
      const diskHit = findMockOnDiskByRequestHash(mockDataPath, resolvedScenarioName, hash);
      if (diskHit) {
        mock = diskHit.mockData;
        mockFilename = diskHit.filename;
        mockSource = 'disk';
      }
    }

    hopIdentity = resolveProxyHopIdentity(
      inboundCorrelation,
      upperMethod,
      url,
      (mock as MockData | null)?.requestId
    );
    applyHopIdentityToProxyLog(networkLogCtx, hopIdentity);
    await ensureInboundParentStubInStore(
      store,
      resolvedScenarioName,
      hopIdentity.parentRequestId,
      parentHopFromBody,
      debugProxy
    );

    const pathRules = await store.getDomainPathRules(resolvedScenarioName);
    const recordResolution = resolveRecordResponsesForRequest({
      url,
      pathRules,
      fromBody: typeof recordResponsesFromBody === 'boolean' ? recordResponsesFromBody : undefined,
      fromScenario: proxyConfig?.recordResponses,
    });

    if (mock && mockShouldServeStoredBody(mock as MockData)) {
      const sanitizedMock: any =
        (mock as any).responseDateOverrides && Array.isArray((mock as any).responseDateOverrides)
          ? {
              ...(mock as any),
              responseDateOverrides: (mock as any).responseDateOverrides.map((o: any) =>
                o && typeof o === 'object' && o.base === 'response' ? { ...o, base: 'now' } : o
              ),
            }
          : (mock as any);
      const responseWithOverrides = {
        ...mock.response,
        data: prepareMockResponseBody(sanitizedMock as MockData, getNow, {
          loadPoolResponse: createServeTimePoolResponseLoader({
            mockDataPath,
            nodeFs: fs,
            joinPath: path.join.bind(path),
          }),
          filename: mockFilename,
          scenarioPath,
          overrideGroupId,
        }),
      };
      if (debugProxy) {
        console.log(
          mockSource === 'disk'
            ? `[ProxyRoute] disk fallback hit: ${upperMethod} ${url} (hash=${hash.slice(0, 8)}…) (lane=${clientId || '—'})`
            : `[ProxyRoute] redis hit: ${upperMethod} ${url} (hash=${hash.slice(0, 8)}…) (lane=${clientId || '—'})`
        );
      }
      await appendProxyNetworkEvent(networkLogCtx, {
        method: upperMethod,
        url,
        clientId: clientId || null,
        deviceId: deviceId || null,
        source: 'mock-hit',
        status: mock.response?.status ?? 200,
        requestHash: hash,
        requestHeaders: toRecordStringHeaders(headers),
        responseHeaders: mock.response?.headers as Record<string, string> | undefined,
        ...proxyNetworkBodyFields(body, responseWithOverrides.data),
      });
      return res.json({
        proxied: false,
        source: mockSource,
        hash,
        clientId: clientId || null,
        deviceId: deviceId || null,
        response: responseWithOverrides,
        scenarioResolution: resolution,
        ...proxyTraceResponseFields(res, networkLogCtx, hopIdentity),
      });
    }
    const shouldPersistLiveCapture = mock
      ? resolveShouldPersistLiveCapture(mock as MockData, {})
      : false;
    const refreshPassthrough = resolveRefreshPassthroughRecordings({});
    const existingSnapshot = mock != null && mockHasCapturableResponse(mock as MockData);
    if (
      mock &&
      existingSnapshot &&
      resolveMockReplayMode(mock as MockData) === 'passthrough' &&
      !refreshPassthrough &&
      !shouldPersistLiveCapture
    ) {
      effectiveRecord = false;
      if (debugProxy) {
        console.log(
          `[ProxyRoute] forced passthrough (alwaysUseRealApi): ${upperMethod} ${url} (hash=${hash.slice(0, 8)}…) (lane=${clientId || '—'})`
        );
      }
    }

    const mockNeedsUpstream = !mock || mockRequiresUpstreamFetch(mock as MockData);
    if (
      recordResolution.recordResponses &&
      mockNeedsUpstream &&
      shouldWriteNewProxyRecording(mock as MockData | null)
    ) {
      effectiveRecord = true;
    }

    if (!effectiveAllowUpstream) {
      if (debugProxy) {
        console.log(
          `[ProxyRoute] upstream blocked: ${upperMethod} ${url} (hash=${hash.slice(0, 8)}…) (lane=${clientId || '—'})`
        );
      }
      await appendProxyNetworkEvent(networkLogCtx, {
        method: upperMethod,
        url,
        clientId: clientId || null,
        deviceId: deviceId || null,
        source: 'blocked',
        status: 412,
        requestHash: hash,
        requestHeaders: toRecordStringHeaders(headers),
        ...proxyNetworkBodyFields(body),
        errorMessage: 'Upstream calls are disabled for this scenario (offline mode).',
      });
      return res.status(412).json({
        proxied: false,
        source: 'blocked',
        hash,
        clientId: clientId || null,
        deviceId: deviceId || null,
        error: 'Upstream calls are disabled for this scenario (offline mode).',
        scenarioResolution: resolution,
      });
    }
    const clientHeaderRecord = toRecordStringHeaders(headers);
    const upstreamHeaders = new Headers();
    copyProxyUpstreamHeadersWithoutHopIds(upstreamHeaders, clientHeaderRecord);
    if (clientId) {
      upstreamHeaders.set(MOCKIFYER_CLIENT_ID_HEADER, clientId);
    }

    const upstreamBody = buildProxyUpstreamBodyInit(body, clientHeaderRecord, upperMethod);
    const init: RequestInit = {
      method: upperMethod,
      headers: upstreamHeaders,
    };
    copyProxyUpstreamHeadersWithoutHopIds(upstreamHeaders, upstreamBody.headers);
    // Hop identity must win over any client/body header bag (always-refresh adopts stored id).
    applyUpstreamRequestCorrelationHeaders(upstreamHeaders, networkLogCtx ?? hopIdentity);
    if (upstreamBody.body !== undefined) {
      init.body = upstreamBody.body as RequestInit['body'];
    }

    const upstreamRes = await fetchProxyUpstream(url, init, upstreamTlsInsecure);
    const contentType = upstreamRes.headers.get('content-type') || '';
    const rawText = await upstreamRes.text();

    let data: any = rawText;
    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = rawText;
      }
    }

    const responseHeaders: Record<string, string> = {};
    upstreamRes.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const response = {
      status: upstreamRes.status,
      data,
      headers: responseHeaders,
    };

    if (mock && shouldPersistLiveCapture) {
      const updatedMock = buildMockDataAfterLiveCapture(mock as MockData, response);
      applyProxyCorrelationToMockData(updatedMock, networkLogCtx, hopIdentity);
      await store.setByHashInScenario(hash, updatedMock, resolvedScenarioName);
      mock = updatedMock;
      if (redisDisk.mirrorWrites) {
        try {
          mirrorRecordedMockToDisk({
            mockDataPath,
            scenarioName: resolvedScenarioName,
            hash,
            mockData: updatedMock as any,
          });
        } catch (mirrorErr: any) {
          console.error('[ProxyRoute] Redis disk mirror write failed:', mirrorErr?.message ?? mirrorErr);
        }
      }
    }

    const clientResponse = mock
      ? buildClientResponseFromLiveCapture(mock as MockData, response, getNow, {
          filename: mockFilename,
          scenarioPath,
          overrideGroupId,
        })
      : response;

    let storedMockForClient: MockData | null = null;
    if (effectiveRecord === true && shouldWriteNewProxyRecording(mock as MockData | null)) {
      const scenarioLocked = await store.isScenarioLocked(resolvedScenarioName);
      if (scenarioLocked) {
        if (debugProxy) {
          console.log(
            `[ProxyRoute] skip record (scenario locked): ${upperMethod} ${url} (hash=${hash.slice(0, 8)}…) (scenario=${resolvedScenarioName}) (lane=${clientId || '—'})`
          );
        }
      } else {
        const recordNewAsPassthrough = resolveRecordNewMocksAsPassthrough({});
        const recordResponses = recordResolution.recordResponses;
        const pathAutoMock = recordResolution.matchedPathRule?.autoMock === true;
        const requestPayload = {
          method: upperMethod,
          url,
          headers: toRecordStringHeaders(headers),
          data: normalizedRequestBody,
          queryParams: {},
        };
        const shouldMarkPassthrough =
          (recordNewAsPassthrough && !mock) ||
          (mock && (mock as MockData).alwaysUseRealApi === true);

        if (!recordResponses) {
          storedMockForClient = buildRequestOnlyMockData(requestPayload as MockData['request'], {
            alwaysUseRealApi: true,
          });
        } else {
          storedMockForClient = {
            request: requestPayload as MockData['request'],
            response,
            timestamp: new Date().toISOString(),
          };
          applyCapturedResponse(storedMockForClient, response);
          if (pathAutoMock) {
            delete storedMockForClient.alwaysUseRealApi;
          } else if (shouldMarkPassthrough) {
            applyRecordingPassthroughFlag(storedMockForClient, true);
          } else {
            delete storedMockForClient.alwaysUseRealApi;
          }
        }

        applyProxyCorrelationToMockData(storedMockForClient, networkLogCtx, hopIdentity);
        const wrote = await store.setByHashInScenario(hash, storedMockForClient, resolvedScenarioName);
        if (wrote && redisDisk.mirrorWrites) {
          try {
            mirrorRecordedMockToDisk({
              mockDataPath,
              scenarioName: resolvedScenarioName,
              hash,
              mockData: storedMockForClient as any,
            });
          } catch (mirrorErr: any) {
            console.error('[ProxyRoute] Redis disk mirror write failed:', mirrorErr?.message ?? mirrorErr);
          }
        }
        if (!wrote) {
          storedMockForClient = null;
        }
      }
    }

    if (debugProxy) {
      console.log(
        `[ProxyRoute] upstream miss: ${upperMethod} ${url} (hash=${hash.slice(0, 8)}…) (lane=${clientId || '—'}) record=${effectiveRecord === true}`
      );
    }
    await appendProxyNetworkEvent(networkLogCtx, {
      method: upperMethod,
      url,
      clientId: clientId || null,
      deviceId: deviceId || null,
      source: mock ? 'upstream' : 'mock-miss',
      status: upstreamRes.status,
      requestHash: hash,
      requestHeaders: toRecordStringHeaders(headers),
      responseHeaders,
      ...proxyNetworkBodyFields(body, clientResponse.data),
    });
    return res.json({
      proxied: true,
      source: 'upstream',
      hash,
      clientId: clientId || null,
      deviceId: deviceId || null,
      scenarioResolution: resolution,
      response: clientResponse,
      recordedToStore: storedMockForClient != null,
      ...proxyTraceResponseFields(res, networkLogCtx, hopIdentity),
      ...(storedMockForClient ? { storedMock: storedMockForClient } : {}),
      ...(shouldPersistLiveCapture ? { refreshedStoredMock: true } : {}),
    });
  } catch (error: any) {
    console.error('[ProxyRoute] Error:', error);
    const logScenario = resolveNetworkLogScenario(
      mockDataPath,
      networkLogCtx?.scenario ?? null,
      bodyScenario
    );
    if (!networkLogCtx && logScenario) {
      networkLogCtx = await openProxyNetworkLog(mockDataPath, config, logScenario, hopIdentity);
    }
    await appendProxyNetworkEvent(networkLogCtx, {
      method: upperMethod,
      url,
      clientId: clientId || null,
      deviceId: deviceId || null,
      source: 'error',
      status: 500,
      requestHash: hash,
      requestHeaders: toRecordStringHeaders(headers),
      ...proxyNetworkBodyFields(body),
      errorMessage: error?.message ?? String(error),
    });
    return res.status(500).json({ error: 'Proxy failed', details: error.message });
  } finally {
    await closeProxyNetworkLog(networkLogCtx);
    await store.close().catch(() => undefined);
  }
});

export const proxyRouter = router;
