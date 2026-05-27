import express, { Request, Response } from 'express';
import fs from 'fs';
import { getDashboardContext, resolveRedisDiskMirrorOptions } from '../utils/dashboard-context';
import { createDashboardMockStore } from '../utils/create-dashboard-mock-store';
import { isCentralizedDashboardProvider } from '../utils/dashboard-provider';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  const { mockDataPath, config } = getDashboardContext(req);
  const provider = config.provider ?? 'filesystem';

  const exists = isCentralizedDashboardProvider(provider) ? true : fs.existsSync(mockDataPath);
  let fileCount = 0;
  if (exists && !isCentralizedDashboardProvider(provider)) {
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
  let sqliteOk: boolean | null = null;
  let sqliteError: string | null = null;
  /** True when redis or sqlite central store responds (proxy / lanes / persistent network log). */
  let centralStoreOk: boolean | null = null;

  if (isCentralizedDashboardProvider(provider)) {
    const store = createDashboardMockStore(config, mockDataPath);
    try {
      await store.ping();
      centralStoreOk = true;
      if (provider === 'redis') {
        redisOk = true;
      } else {
        sqliteOk = true;
      }
    } catch (e: unknown) {
      centralStoreOk = false;
      const message = e instanceof Error ? e.message : String(e);
      if (provider === 'redis') {
        redisOk = false;
        redisError = message;
      } else {
        sqliteOk = false;
        sqliteError = message;
      }
    } finally {
      await store.close().catch(() => undefined);
    }
  }

  const redisDiskMirror =
    isCentralizedDashboardProvider(provider) ? resolveRedisDiskMirrorOptions(config) : null;

  return res.json({
    status: 'ok',
    provider,
    mockDataPath,
    exists,
    fileCount,
    redisOk,
    redisError,
    sqliteOk,
    sqliteError,
    centralStoreOk,
    ...(redisDiskMirror ? { redisDiskMirror } : {}),
    timestamp: new Date().toISOString(),
  });
});

export const healthRouter = router;
