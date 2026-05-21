import express, { Request, Response } from 'express';
import * as crypto from 'crypto';
import {
  getCurrentScenario,
  generateRequestKey,
  buildRequestOnlyMockData,
  applyCapturedResponse,
  mockHasCapturableResponse,
} from '@sgedda/mockifyer-core';
import type { NetworkEvent, MockData } from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import { createNetworkLogStore } from '../utils/network-log-store';
import { RedisMockStore } from '../utils/redis-mock-store';
import { fetchUpstreamResponse } from '../utils/capture-upstream-response';

const router = express.Router();

function parseLimit(raw: unknown, fallback = 200): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 5000);
}

function resolveScenario(req: Request, mockDataPath: string): string {
  const q = req.query.scenario;
  if (typeof q === 'string' && q.trim()) return q.trim();
  const bodyScenario = req.body?.scenario;
  if (typeof bodyScenario === 'string' && bodyScenario.trim()) return bodyScenario.trim();
  return getCurrentScenario(mockDataPath);
}

router.get('/config', async (req: Request, res: Response) => {
  const { mockDataPath, config } = getDashboardContext(req);
  const scenario = resolveScenario(req, mockDataPath);
  const store = createNetworkLogStore(config);
  try {
    const networkLogConfig = await store.getConfig(scenario);
    return res.json({
      scenario,
      provider: config.provider,
      ...networkLogConfig,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message ?? 'Failed to load network log config' });
  } finally {
    await store.close().catch(() => undefined);
  }
});

router.put('/config', async (req: Request, res: Response) => {
  const { mockDataPath, config } = getDashboardContext(req);
  const scenario = resolveScenario(req, mockDataPath);
  const { enabled, captureBodies } = req.body || {};
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }
  if (captureBodies !== undefined && typeof captureBodies !== 'boolean') {
    return res.status(400).json({ error: 'captureBodies must be a boolean' });
  }

  const store = createNetworkLogStore(config);
  try {
    const networkLogConfig = await store.setConfig(scenario, { enabled, captureBodies });
    return res.json({ scenario, provider: config.provider, ...networkLogConfig });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message ?? 'Failed to update network log config' });
  } finally {
    await store.close().catch(() => undefined);
  }
});

router.get('/', async (req: Request, res: Response) => {
  const { mockDataPath, config } = getDashboardContext(req);
  const scenario = resolveScenario(req, mockDataPath);
  const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
  const since = typeof req.query.since === 'string' ? req.query.since : undefined;
  const limit = parseLimit(req.query.limit);

  const store = createNetworkLogStore(config);
  try {
    const [{ events, ephemeral }, networkLogConfig] = await Promise.all([
      store.list({ scenario, clientId, limit, since }),
      store.getConfig(scenario),
    ]);
    return res.json({
      scenario,
      provider: config.provider,
      ephemeral,
      networkLogConfig,
      events,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message ?? 'Failed to list network events' });
  } finally {
    await store.close().catch(() => undefined);
  }
});

router.post('/', async (req: Request, res: Response) => {
  const { mockDataPath, config } = getDashboardContext(req);
  const scenario = resolveScenario(req, mockDataPath);
  const incoming = (req.body?.event ?? req.body) as Partial<NetworkEvent> | undefined;

  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'Request body must include an event object' });
  }
  if (!incoming.method || !incoming.url || !incoming.source || !incoming.transport) {
    return res.status(400).json({
      error: 'event requires method, url, source, and transport',
    });
  }

  const store = createNetworkLogStore(config);
  try {
    const saved = await store.append(scenario, {
      transport: incoming.transport!,
      method: incoming.method!,
      url: incoming.url!,
      source: incoming.source!,
      clientId: incoming.clientId ?? null,
      deviceId: incoming.deviceId ?? null,
      sessionId: incoming.sessionId,
      requestId: incoming.requestId,
      parentRequestId: incoming.parentRequestId,
      sequence: incoming.sequence,
      phase: incoming.phase,
      host: incoming.host,
      path: incoming.path,
      query: incoming.query,
      status: incoming.status,
      durationMs: incoming.durationMs,
      requestHash: incoming.requestHash,
      requestHeaders: incoming.requestHeaders,
      responseHeaders: incoming.responseHeaders,
      requestBodyPreview: incoming.requestBodyPreview,
      responseBodyPreview: incoming.responseBodyPreview,
      errorMessage: incoming.errorMessage,
      id: incoming.id,
      timestamp: incoming.timestamp,
    });
    if (!saved) {
      return res.json({ ok: true, skipped: true, reason: 'network_logging_disabled' });
    }
    return res.status(201).json({ ok: true, event: saved });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message ?? 'Failed to append network event' });
  } finally {
    await store.close().catch(() => undefined);
  }
});

type PromoteAction = 'register' | 'capture_response' | 'activate';

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Promote a network-log row into the mock corpus (request-only, capture, or activate).
 */
router.post('/promote', async (req: Request, res: Response) => {
  const { mockDataPath, config } = getDashboardContext(req);
  const scenario = resolveScenario(req, mockDataPath);
  const {
    action,
    method,
    url,
    clientId,
    requestHash: requestHashFromBody,
    headers,
    body,
  } = req.body || {};

  if (!['register', 'capture_response', 'activate'].includes(action)) {
    return res.status(400).json({ error: 'action must be register, capture_response, or activate' });
  }
  if (typeof method !== 'string' || !method.trim() || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'method and url are required' });
  }

  const upperMethod = method.trim().toUpperCase();
  const storedRequest = {
    method: upperMethod,
    url: url.trim(),
    headers: (headers && typeof headers === 'object' ? headers : {}) as Record<string, string>,
    data: body,
    queryParams: {},
  };
  const requestKey = generateRequestKey(storedRequest as any);
  const hash =
    typeof requestHashFromBody === 'string' && /^[a-f0-9]{64}$/i.test(requestHashFromBody)
      ? requestHashFromBody
      : sha256Hex(requestKey);

  if (config.provider !== 'redis') {
    return res.status(400).json({ error: 'Network promote requires dashboard provider redis' });
  }

  const store = new RedisMockStore({
    redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
    keyPrefix: config.keyPrefix,
    mockDataPath,
  });

  try {
    let mock = (await store.getByHashInScenario(hash, scenario)) as MockData | null;

    if (action === 'register') {
      if (!mock) {
        mock = buildRequestOnlyMockData(storedRequest as any, { alwaysUseRealApi: true });
        await store.setByHashInScenario(hash, mock, scenario);
      }
      return res.json({
        ok: true,
        action,
        hash,
        filename: `redis/${hash}.json`,
        responsePending: mock.responsePending === true,
        alwaysUseRealApi: mock.alwaysUseRealApi === true,
      });
    }

    if (action === 'capture_response') {
      const { response } = await fetchUpstreamResponse(storedRequest as any, {
        clientId: typeof clientId === 'string' ? clientId : undefined,
      });
      if (!mock) {
        mock = buildRequestOnlyMockData(storedRequest as any, { alwaysUseRealApi: true });
      }
      applyCapturedResponse(mock, response);
      mock.timestamp = new Date().toISOString();
      await store.setByHashInScenario(hash, mock, scenario);
      return res.json({
        ok: true,
        action,
        hash,
        filename: `redis/${hash}.json`,
        status: response.status,
        responsePending: false,
        alwaysUseRealApi: mock.alwaysUseRealApi === true,
      });
    }

    // activate
    if (!mock) {
      return res.status(404).json({ error: 'No mock registered for this request. Use register or capture_response first.' });
    }
    if (!mockHasCapturableResponse(mock)) {
      return res.status(400).json({
        error: 'Response not captured yet. Run capture_response before activating the mock.',
      });
    }
    delete mock.alwaysUseRealApi;
    delete mock.responsePending;
    mock.timestamp = new Date().toISOString();
    await store.setByHashInScenario(hash, mock, scenario);
    return res.json({
      ok: true,
      action,
      hash,
      filename: `redis/${hash}.json`,
      alwaysUseRealApi: false,
      responsePending: false,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message ?? 'promote failed' });
  } finally {
    await store.close().catch(() => undefined);
  }
});

router.delete('/', async (req: Request, res: Response) => {
  const { mockDataPath, config } = getDashboardContext(req);
  const scenario = resolveScenario(req, mockDataPath);
  const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;

  const store = createNetworkLogStore(config);
  try {
    const removed = await store.clear({ scenario, clientId });
    return res.json({ ok: true, removed, scenario, clientId: clientId ?? null });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message ?? 'Failed to clear network events' });
  } finally {
    await store.close().catch(() => undefined);
  }
});

export const networkEventsRouter = router;
