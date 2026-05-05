import express, { Request, Response } from 'express';
import { getDashboardContext } from '../utils/dashboard-context';
import { RedisMockStore } from '../utils/redis-mock-store';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    if (config.provider !== 'redis') {
      return res.json({
        enabled: false,
        reason: "Client lanes are only available when the dashboard provider is 'redis'.",
        lanes: [],
        globalScenario: null,
      });
    }

    const store = new RedisMockStore({
      redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
      keyPrefix: config.keyPrefix,
      mockDataPath,
    });
    try {
      const lanes = await store.listClientLanes();
      const globalScenario = await store.getActiveScenario();
      return res.json({ enabled: true, lanes, globalScenario });
    } finally {
      await store.close().catch(() => undefined);
    }
  } catch (error: any) {
    console.error('[ClientLanesRoute] List - Error:', error);
    return res.status(500).json({ error: 'Failed to list client lanes', details: error.message });
  }
});

router.put('/:clientId/scenario', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { scenario } = req.body || {};
    const { mockDataPath, config } = getDashboardContext(req);
    if (config.provider !== 'redis') {
      return res.status(400).json({ error: "client lanes require dashboard provider 'redis'." });
    }
    if (!clientId || !clientId.trim()) return res.status(400).json({ error: 'clientId is required' });

    const scenarioValue =
      scenario === null
        ? null
        : typeof scenario === 'string' && scenario.trim()
          ? scenario.trim()
          : undefined;
    if (scenarioValue === undefined) {
      return res.status(400).json({ error: 'scenario must be a non-empty string or null' });
    }

    const store = new RedisMockStore({
      redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
      keyPrefix: config.keyPrefix,
      mockDataPath,
    });
    try {
      await store.setLaneScenario(clientId, scenarioValue);
      const lanes = await store.listClientLanes();
      const globalScenario = await store.getActiveScenario();
      return res.json({ success: true, lanes, globalScenario });
    } finally {
      await store.close().catch(() => undefined);
    }
  } catch (error: any) {
    console.error('[ClientLanesRoute] Set scenario - Error:', error);
    return res.status(500).json({ error: 'Failed to set lane scenario', details: error.message });
  }
});

router.put('/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { note } = req.body || {};
    const { mockDataPath, config } = getDashboardContext(req);
    if (config.provider !== 'redis') {
      return res.status(400).json({ error: "client lanes require dashboard provider 'redis'." });
    }
    if (!clientId || !clientId.trim()) return res.status(400).json({ error: 'clientId is required' });

    const noteValue =
      note === null
        ? null
        : typeof note === 'string'
          ? note
          : undefined;
    if (noteValue === undefined) {
      return res.status(400).json({ error: 'note must be a string or null' });
    }

    const store = new RedisMockStore({
      redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
      keyPrefix: config.keyPrefix,
      mockDataPath,
    });
    try {
      await store.setLaneNote(clientId, noteValue);
      const lanes = await store.listClientLanes();
      const globalScenario = await store.getActiveScenario();
      return res.json({ success: true, lanes, globalScenario });
    } finally {
      await store.close().catch(() => undefined);
    }
  } catch (error: any) {
    console.error('[ClientLanesRoute] Set note - Error:', error);
    return res.status(500).json({ error: 'Failed to set lane note', details: error.message });
  }
});

export const clientLanesRouter = router;

