import express, { Request, Response } from 'express';
import { getDashboardContext } from '../utils/dashboard-context';
import { RedisMockStore } from '../utils/redis-mock-store';
import {
  generateRequestKey,
  getCurrentDate,
  MOCKIFYER_CLIENT_ID_HEADER,
  prepareMockResponseBody,
} from '@sgedda/mockifyer-core';
import * as crypto from 'crypto';

const router = express.Router();

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function deriveFallbackDeviceId(req: Request): string | undefined {
  // Only derive when we have some reasonable entropy; keep it stable-ish per device/browser.
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

  const { url, method, headers, body, scenario, record, allowUpstream, clientId: clientIdFromBody, deviceId: deviceIdFromBody } = req.body || {};
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

  // Build StoredRequest-like shape for request keying
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

  try {
    // Best-effort lane discovery for dashboard UX (autocomplete). No effect if clientId is absent.
    if (clientId) {
      await store.recordLaneSeen(clientId).catch(() => undefined);
    }
    // Best-effort device discovery for dashboard UX.
    // If the SDK doesn't send a deviceId, we derive a stable-ish one so "devices seen" isn't stuck at 0.
    if (clientId && deviceId) await store.recordLaneDeviceSeen(clientId, deviceId).catch(() => undefined);

    const resolvedScenario = await store.getResolvedScenario(
      typeof scenario === 'string' && scenario.trim() ? scenario.trim() : undefined,
      clientId
    );

    const proxyConfig = await store.getProxyConfig(resolvedScenario);
    let effectiveRecord =
      typeof record === 'boolean' ? record : (proxyConfig?.recordOnMiss ?? true);
    const effectiveAllowUpstream =
      typeof allowUpstream === 'boolean' ? allowUpstream : (proxyConfig?.allowUpstream ?? true);

    const redisDateDoc = await store.getDateConfig(resolvedScenario);
    const getNow = () =>
      getCurrentDate({
        mockDataPath,
        scenario: resolvedScenario,
        // If the Redis key exists but dateManipulation is missing/null, treat it as an explicit "clear"
        // so we do NOT fall back to filesystem date-config.json.
        explicitManipulation: redisDateDoc === null ? null : (redisDateDoc.dateManipulation ?? {}),
      });

    // 1) Try Redis hit
    const mock = await store.getByHash(hash, scenario, clientId);
    if (mock) {
      // If this recording is marked as passthrough, do NOT serve it from Redis.
      // Instead, force an upstream request (and never record that upstream response).
      // This matches the filesystem provider behavior where `alwaysUseRealApi` means
      // "skip this mock in replay mode".
      if ((mock as any).alwaysUseRealApi === true) {
        effectiveRecord = false;
        if (debugProxy) {
          console.log(
            `[ProxyRoute] forced passthrough (alwaysUseRealApi): ${upperMethod} ${url} (hash=${hash.slice(0, 8)}…) (lane=${clientId || '—'})`
          );
        }
      } else {
      // Guardrail: some projects recorded responseDateOverrides with base='response', which can drift
      // based on stale recorded timestamps even when "now" is correct. In Redis-proxy mode we want
      // overrides to be relative to the current manipulated date.
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
          `[ProxyRoute] redis hit: ${upperMethod} ${url} (hash=${hash.slice(0, 8)}…) (lane=${clientId || '—'})`
        );
      }
      return res.json({
        proxied: false,
        source: 'redis',
        hash,
        clientId: clientId || null,
        deviceId: deviceId || null,
        response: responseWithOverrides,
      });
      }
    }

    // 2) Miss: proxy to real upstream
    if (!effectiveAllowUpstream) {
      if (debugProxy) {
        console.log(
          `[ProxyRoute] upstream blocked: ${upperMethod} ${url} (hash=${hash.slice(0, 8)}…) (lane=${clientId || '—'})`
        );
      }
      return res.status(412).json({
        proxied: false,
        source: 'blocked',
        hash,
        clientId: clientId || null,
        deviceId: deviceId || null,
        error: 'Upstream calls are disabled for this scenario (offline mode).',
      });
    }
    const upstreamHeaders = new Headers();
    for (const [k, v] of Object.entries(toRecordStringHeaders(headers))) {
      // Avoid forwarding hop-by-hop headers; keep it minimal.
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
      // If already a string, send as-is; else JSON encode.
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

    if (effectiveRecord === true) {
      const mockData = {
        request: {
          method: upperMethod,
          url,
          headers: toRecordStringHeaders(headers),
          data: body,
          queryParams: {},
        },
        response,
        timestamp: new Date().toISOString(),
      };
      await store.setByHash(hash, mockData as any, scenario, clientId);
    }

    if (debugProxy) {
      console.log(
        `[ProxyRoute] upstream miss: ${upperMethod} ${url} (hash=${hash.slice(0, 8)}…) (lane=${clientId || '—'}) record=${effectiveRecord === true}`
      );
    }
    return res.json({
      proxied: true,
      source: 'upstream',
      hash,
      clientId: clientId || null,
      deviceId: deviceId || null,
      response,
    });
  } catch (error: any) {
    console.error('[ProxyRoute] Error:', error);
    return res.status(500).json({ error: 'Proxy failed', details: error.message });
  } finally {
    await store.close().catch(() => undefined);
  }
});

export const proxyRouter = router;

