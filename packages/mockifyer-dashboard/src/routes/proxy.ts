import express, { Request, Response } from 'express';
import { getDashboardContext, resolveRedisDiskMirrorOptions } from '../utils/dashboard-context';
import { RedisMockStore } from '../utils/redis-mock-store';
import { findMockOnDiskByRequestHash, mirrorRecordedMockToDisk } from '../utils/redis-disk-mirror';
import {
  generateRequestKey,
  getCurrentDate,
  MOCKIFYER_CLIENT_ID_HEADER,
  prepareMockResponseBody,
  mockShouldServeStoredBody,
  buildClientResponseFromLiveCapture,
  buildMockDataAfterLiveCapture,
  resolveShouldPersistLiveCapture,
  resolveMockReplayMode,
  resolveRecordNewMocksAsPassthrough,
  resolveRefreshPassthroughRecordings,
  applyRecordingPassthroughFlag,
  buildRequestOnlyMockData,
  applyCapturedResponse,
  resolveRecordResponsesForRequest,
  type MockData,
} from '@sgedda/mockifyer-core';
import * as crypto from 'crypto';
import {
  appendProxyNetworkEvent,
  closeProxyNetworkLog,
  openProxyNetworkLog,
  resolveNetworkLogScenario,
} from '../utils/proxy-network-log';
import { shouldRecordNewProxyMock } from '../utils/proxy-recording';

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

function toRecordStringHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers || typeof headers !== 'object') return out;
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

router.post('/', async (req: Request, res: Response) => {
  const { mockDataPath, config } = getDashboardContext(req);
  const debugProxy = process.env.MOCKIFYER_PROXY_DEBUG === 'true';

  if (config.provider !== 'redis') {
    return res.status(400).json({ error: "Proxy requires dashboard provider 'redis'." });
  }

  const {
    url,
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
  } = req.body || {};
  const requestStrictLane =
    typeof strictLaneScenarioFromBody === 'boolean' ? strictLaneScenarioFromBody : undefined;
  const clientIdFromHeader =
    typeof req.header('x-mockifyer-client-id') === 'string' ? String(req.header('x-mockifyer-client-id')) : undefined;
  const clientId = typeof clientIdFromBody === 'string' && clientIdFromBody.trim()
    ? clientIdFromBody.trim()
    : (clientIdFromHeader && clientIdFromHeader.trim() ? clientIdFromHeader.trim() : undefined);
  const deviceIdFromHeader =
    typeof req.header('x-mockifyer-device-id') === 'string' ? String(req.header('x-mockifyer-device-id')) : undefined;
  const deviceId =
    typeof deviceIdFromBody === 'string' && deviceIdFromBody.trim()
      ? deviceIdFromBody.trim()
      : deviceIdFromHeader && deviceIdFromHeader.trim()
        ? deviceIdFromHeader.trim()
        : deriveFallbackDeviceId(req);
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url is required' });

  const upperMethod = String(method || 'GET').toUpperCase();
  const bodyScenario = typeof scenario === 'string' && scenario.trim() ? scenario.trim() : undefined;

  const storedRequest = {
    method: upperMethod,
    url,
    headers: toRecordStringHeaders(headers),
    data: body,
    queryParams: undefined as any,
  };

  const requestKey = generateRequestKey(storedRequest as any);
  const hash = sha256Hex(requestKey);

  const store = new RedisMockStore({
    redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
    keyPrefix: config.keyPrefix,
    mockDataPath,
  });

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
      networkLogCtx = await openProxyNetworkLog(mockDataPath, config, logScenario);

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
      const upstreamHeaders = new Headers();
      for (const [k, v] of Object.entries(toRecordStringHeaders(headers))) {
        if (k.toLowerCase() === 'host') continue;
        upstreamHeaders.set(k, v);
      }
      if (clientId) {
        upstreamHeaders.set(MOCKIFYER_CLIENT_ID_HEADER, clientId);
      }

      const init: RequestInit = {
        method: upperMethod,
        headers: upstreamHeaders,
      };

      if (body !== undefined && body !== null && upperMethod !== 'GET' && upperMethod !== 'HEAD') {
        init.body = typeof body === 'string' ? body : JSON.stringify(body);
        if (!upstreamHeaders.has('content-type')) {
          upstreamHeaders.set('content-type', 'application/json');
        }
      }

      const upstreamRes = await fetch(url, init);
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
        requestHeaders: toRecordStringHeaders(headers),
        responseHeaders,
      });
      return res.json({
        proxied: true,
        source: 'upstream_strict_lane_unresolved',
        hash,
        clientId: clientId || null,
        deviceId: deviceId || null,
        scenarioResolution: resolution,
        response,
      });
    }

    const resolvedScenarioName = resolution.scenario;
    networkLogCtx = await openProxyNetworkLog(mockDataPath, config, resolvedScenarioName);

    const proxyConfig = await store.getProxyConfig(resolvedScenarioName);
    let effectiveRecord = typeof record === 'boolean' ? record : proxyConfig?.recordOnMiss ?? true;
    const effectiveAllowUpstream =
      typeof allowUpstream === 'boolean' ? allowUpstream : proxyConfig?.allowUpstream ?? true;

    const redisDateDoc = await store.getDateConfig(resolvedScenarioName);
    const getNow = () =>
      getCurrentDate({
        mockDataPath,
        scenario: resolvedScenarioName,
        explicitManipulation: redisDateDoc === null ? null : (redisDateDoc.dateManipulation ?? {}),
      });

    let mock = await store.getByHashInScenario(hash, resolvedScenarioName);
    let mockSource: 'redis' | 'disk' = 'redis';

    if (!mock && redisDisk.readFallback) {
      const diskMock: any = findMockOnDiskByRequestHash(mockDataPath, resolvedScenarioName, hash);
      if (diskMock) {
        mock = diskMock;
        mockSource = 'disk';
      }
    }

    const hadMockAtRequestStart = Boolean(mock);

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
        data: prepareMockResponseBody(sanitizedMock, getNow),
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
      });
      return res.json({
        proxied: false,
        source: mockSource,
        hash,
        clientId: clientId || null,
        deviceId: deviceId || null,
        response: responseWithOverrides,
        scenarioResolution: resolution,
      });
    }
    const shouldPersistLiveCapture = mock
      ? resolveShouldPersistLiveCapture(mock as MockData, {})
      : false;
    const refreshPassthrough = resolveRefreshPassthroughRecordings({});
    if (
      mock &&
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
    const upstreamHeaders = new Headers();
    for (const [k, v] of Object.entries(toRecordStringHeaders(headers))) {
      if (k.toLowerCase() === 'host') continue;
      upstreamHeaders.set(k, v);
    }
    if (clientId) {
      upstreamHeaders.set(MOCKIFYER_CLIENT_ID_HEADER, clientId);
    }

    const init: RequestInit = {
      method: upperMethod,
      headers: upstreamHeaders,
    };

    if (body !== undefined && body !== null && upperMethod !== 'GET' && upperMethod !== 'HEAD') {
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
      if (!upstreamHeaders.has('content-type')) {
        upstreamHeaders.set('content-type', 'application/json');
      }
    }

    const upstreamRes = await fetch(url, init);
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
      ? buildClientResponseFromLiveCapture(mock as MockData, response, getNow)
      : response;

    let storedMockForClient: MockData | null = null;
    let recordedNewMock = false;
    if (shouldRecordNewProxyMock(effectiveRecord === true, hadMockAtRequestStart)) {
      const recordNewAsPassthrough = resolveRecordNewMocksAsPassthrough({});
      const pathRules = await store.getDomainPathRules(resolvedScenarioName);
      const recordResolution = resolveRecordResponsesForRequest({
        url,
        pathRules,
        fromBody: typeof recordResponsesFromBody === 'boolean' ? recordResponsesFromBody : undefined,
        fromScenario: proxyConfig?.recordResponses,
      });
      const recordResponses = recordResolution.recordResponses;
      const pathAutoMock = recordResolution.matchedPathRule?.autoMock === true;
      const requestPayload = {
        method: upperMethod,
        url,
        headers: toRecordStringHeaders(headers),
        data: body,
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

      await store.setByHashInScenario(hash, storedMockForClient, resolvedScenarioName);
      recordedNewMock = true;
      if (redisDisk.mirrorWrites) {
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
    }

    if (debugProxy) {
      console.log(
        `[ProxyRoute] upstream miss: ${upperMethod} ${url} (hash=${hash.slice(0, 8)}…) (lane=${clientId || '—'}) record=${recordedNewMock}`
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
    });
    return res.json({
      proxied: true,
      source: 'upstream',
      hash,
      clientId: clientId || null,
      deviceId: deviceId || null,
      scenarioResolution: resolution,
      response: clientResponse,
      recordedToStore: recordedNewMock,
      ...(recordedNewMock && storedMockForClient
        ? { storedMock: storedMockForClient }
        : {}),
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
      networkLogCtx = await openProxyNetworkLog(mockDataPath, config, logScenario);
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
      errorMessage: error?.message ?? String(error),
    });
    return res.status(500).json({ error: 'Proxy failed', details: error.message });
  } finally {
    await closeProxyNetworkLog(networkLogCtx);
    await store.close().catch(() => undefined);
  }
});

export const proxyRouter = router;
