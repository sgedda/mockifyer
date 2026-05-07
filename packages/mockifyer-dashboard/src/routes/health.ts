import express, { Request, Response } from 'express';
import fs from 'fs';
import { getDashboardContext } from '../utils/dashboard-context';
import { RedisMockStore } from '../utils/redis-mock-store';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  const { mockDataPath, config } = getDashboardContext(req);
  const provider = config.provider ?? 'filesystem';

  const exists = provider === 'redis' ? true : fs.existsSync(mockDataPath);
  let fileCount = 0;
  if (exists && provider !== 'redis') {
    try {
      const files = fs
        .readdirSync(mockDataPath)
        .filter((file) => file.endsWith('.json') && file !== 'date-config.json');
      fileCount = files.length;
    } catch {
      // Ignore errors
    }
  }

  let redisOk: boolean | null = null;
  let redisError: string | null = null;
  if (provider === 'redis') {
    const store = new RedisMockStore({
      redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
      keyPrefix: config.keyPrefix,
      mockDataPath,
    });
    try {
      await store.ping();
      redisOk = true;
    } catch (e: any) {
      redisOk = false;
      redisError = e?.message ?? String(e);
    } finally {
      await store.close().catch(() => undefined);
    }
  }

  return res.json({
    status: 'ok',
    provider,
    mockDataPath,
    exists,
    fileCount,
    redisOk,
    redisError,
    timestamp: new Date().toISOString(),
  });
});

export const healthRouter = router;

