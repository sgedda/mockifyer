import express, { Request, Response } from 'express';
import { getDashboardContext } from '../utils/dashboard-context';
import { RedisMockStore } from '../utils/redis-mock-store';

const router = express.Router();

function readScenarioParam(req: Request): string {
  const raw = req.query.scenario;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return 'default';
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    if (config.provider !== 'redis') {
      return res.status(400).json({ error: "Proxy config requires dashboard provider 'redis'." });
    }

    const scenario = readScenarioParam(req);
    const store = new RedisMockStore({
      redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
      keyPrefix: config.keyPrefix,
      mockDataPath,
    });
    try {
      const doc = await store.getProxyConfig(scenario);
      return res.json({
        scenario,
        recordOnMiss: doc?.recordOnMiss ?? true,
        allowUpstream: doc?.allowUpstream ?? true,
        recordResponses: doc?.recordResponses ?? true,
        updatedAt: doc?.updatedAt ?? null,
      });
    } finally {
      await store.close().catch(() => undefined);
    }
  } catch (error: any) {
    console.error('[ProxyConfigRoute] Get - Error:', error);
    return res.status(500).json({ error: 'Failed to read proxy config', details: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    if (config.provider !== 'redis') {
      return res.status(400).json({ error: "Proxy config requires dashboard provider 'redis'." });
    }

    const { scenario, recordOnMiss, allowUpstream, recordResponses } = req.body || {};
    if (typeof scenario !== 'string' || !scenario.trim()) {
      return res.status(400).json({ error: 'scenario is required' });
    }
    if (typeof recordOnMiss !== 'boolean') {
      return res.status(400).json({ error: 'recordOnMiss must be a boolean' });
    }
    if (typeof allowUpstream !== 'boolean') {
      return res.status(400).json({ error: 'allowUpstream must be a boolean' });
    }
    if (recordResponses !== undefined && typeof recordResponses !== 'boolean') {
      return res.status(400).json({ error: 'recordResponses must be a boolean' });
    }

    const store = new RedisMockStore({
      redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
      keyPrefix: config.keyPrefix,
      mockDataPath,
    });
    try {
      const existing = await store.getProxyConfig(scenario.trim());
      await store.setProxyConfig(scenario.trim(), {
        recordOnMiss,
        allowUpstream,
        recordResponses:
          typeof recordResponses === 'boolean' ? recordResponses : (existing?.recordResponses ?? true),
        updatedAt: new Date().toISOString(),
      });
      return res.json({ success: true });
    } finally {
      await store.close().catch(() => undefined);
    }
  } catch (error: any) {
    console.error('[ProxyConfigRoute] Set - Error:', error);
    return res.status(500).json({ error: 'Failed to update proxy config', details: error.message });
  }
});

export const proxyConfigRouter = router;

