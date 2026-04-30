import express, { Request, Response } from 'express';
import { getDashboardContext } from '../utils/dashboard-context';
import { RedisMockStore } from '../utils/redis-mock-store';
import { generateRequestKey, getCurrentDate, prepareMockResponseBody } from '@sgedda/mockifyer-core';
import * as crypto from 'crypto';

const router = express.Router();

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
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

  if (config.provider !== 'redis') {
    return res.status(400).json({ error: "Proxy requires dashboard provider 'redis'." });
  }

  const { url, method, headers, body, scenario, record } = req.body || {};
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
    // 1) Try Redis hit
    const mock = await store.getByHash(hash, scenario);
    if (mock) {
      const responseWithOverrides = {
        ...mock.response,
        data: prepareMockResponseBody(mock as any, getCurrentDate),
      };
      return res.json({
        proxied: false,
        source: 'redis',
        hash,
        response: responseWithOverrides,
      });
    }

    // 2) Miss: proxy to real upstream
    const upstreamHeaders = new Headers();
    for (const [k, v] of Object.entries(toRecordStringHeaders(headers))) {
      // Avoid forwarding hop-by-hop headers; keep it minimal.
      if (k.toLowerCase() === 'host') continue;
      upstreamHeaders.set(k, v);
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

    if (record === true) {
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
      await store.setByHash(hash, mockData as any, scenario);
    }

    return res.json({
      proxied: true,
      source: 'upstream',
      hash,
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

