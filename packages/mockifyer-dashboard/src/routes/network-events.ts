import express, { Request, Response } from 'express';
import { getCurrentScenario } from '@sgedda/mockifyer-core';
import type { NetworkEvent } from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import { createNetworkLogStore } from '../utils/network-log-store';

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
