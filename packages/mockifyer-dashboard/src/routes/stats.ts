import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { detectMockDataPath } from '../utils/path-detector';
import { getAllJsonFiles } from '../utils/json-files';
import { getCurrentScenario, getScenarioFolderPath } from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import { RedisMockStore } from '../utils/redis-mock-store';

const router = express.Router();

function getMockDataPath(): string {
  // Use the shared path detection function
  return detectMockDataPath();
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    /** Must match /api/mocks: prefer explicit ?scenario= (dashboard) over env-only getCurrentScenario(). */
    const requestedScenario = req.query.scenario as string | undefined;
    const currentScenario = requestedScenario || getCurrentScenario(mockDataPath);
    const scenarioPath = path.resolve(getScenarioFolderPath(mockDataPath, currentScenario));

    if (config.provider === 'redis') {
      const store = new RedisMockStore({
        redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
        keyPrefix: config.keyPrefix,
        mockDataPath,
      });

      try {
        const items = await store.list(currentScenario);
        let totalSize = 0;
        const endpoints: Record<string, number> = {};
        const domains: Record<string, number> = {};
        const methods: Record<string, number> = {};
        const statusCodes: Record<string, number> = {};
        const recentActivity: Array<{ filename: string; modified: Date }> = [];

        for (const { hash, mockData } of items) {
          const payload = JSON.stringify(mockData);
          totalSize += Buffer.byteLength(payload);
          const ts = mockData.timestamp ? new Date(mockData.timestamp) : new Date();
          recentActivity.push({ filename: `redis/${hash}.json`, modified: ts });

          if (mockData.request) {
            const endpoint = mockData.request.url || 'unknown';
            endpoints[endpoint] = (endpoints[endpoint] || 0) + 1;
            const method = (mockData.request.method || 'unknown').toUpperCase();
            methods[method] = (methods[method] || 0) + 1;
            try {
              const url = new URL(endpoint);
              domains[url.hostname] = (domains[url.hostname] || 0) + 1;
            } catch {
              // ignore
            }
          }
          if ((mockData as any).response) {
            const status = String((mockData as any).response?.status || 200);
            statusCodes[status] = (statusCodes[status] || 0) + 1;
          }
        }

        recentActivity.sort((a, b) => b.modified.getTime() - a.modified.getTime());
        const topEndpoints = Object.entries(endpoints)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([endpoint, count]) => ({ endpoint, count }));

        const lanes = await store.listClientLanes().catch(() => [] as Array<{ clientId: string; scenario: string; note: string | null }>);
        type RedisRecentDeviceRow = {
          clientId: string;
          configuredScenario: string;
          note: string | null;
          laneLastSeenResolvedScenario: string | null;
          laneLastSeenResolvedAt: string | null;
          deviceId: string;
          deviceLastSeenAt: string;
          lastSeenResolvedScenario: string | null;
          lastSeenResolvedAt: string | null;
          resolutionSource: string | null;
          clientBodyScenarioOverride: boolean;
        };
        const redisDeviceRows: RedisRecentDeviceRow[] = [];
        for (const lane of lanes) {
          const devices = await store.listLaneDevices(lane.clientId, 35).catch(() => []);
          const laneEffective = await store.readLaneLastResolved(lane.clientId).catch(() => null);
          for (const d of devices) {
            const deviceEffective = await store.readDeviceLastResolved(lane.clientId, d.deviceId).catch(() => null);
            redisDeviceRows.push({
              clientId: lane.clientId,
              configuredScenario: lane.scenario,
              note: lane.note && lane.note.trim() ? lane.note.trim() : null,
              laneLastSeenResolvedScenario: laneEffective?.lastEffectiveScenario ?? null,
              laneLastSeenResolvedAt: laneEffective?.lastSeenAt ?? null,
              deviceId: d.deviceId,
              deviceLastSeenAt: new Date(d.lastSeenMs).toISOString(),
              lastSeenResolvedScenario: deviceEffective?.lastEffectiveScenario ?? null,
              lastSeenResolvedAt: deviceEffective?.lastSeenAt ?? null,
              resolutionSource: deviceEffective?.resolutionSource ?? null,
              clientBodyScenarioOverride: deviceEffective?.clientBodyScenarioOverride ?? false,
            });
          }
        }
        redisDeviceRows.sort(
          (a, b) => new Date(b.deviceLastSeenAt).getTime() - new Date(a.deviceLastSeenAt).getTime()
        );
        let globalRedisScenario = currentScenario;
        try {
          globalRedisScenario = await store.getActiveScenario();
        } catch {
          globalRedisScenario = currentScenario;
        }

        return res.json({
          totalFiles: items.length,
          totalSize,
          endpoints: topEndpoints,
          domains,
          methods,
          statusCodes,
          recentActivity: recentActivity.slice(0, 10).map((item) => ({
            filename: item.filename,
            modified: item.modified.toISOString(),
          })),
          folderBreakdown: [],
          scenario: currentScenario,
          mockDataPath,
          scenarioPath: `redis://${config.keyPrefix || 'mockifyer:v1'}:index:${currentScenario}`,
          redisRecentDevices: {
            enabled: true,
            globalScenario: globalRedisScenario,
            rows: redisDeviceRows.slice(0, 40),
          },
        });
      } finally {
        await store.close().catch(() => undefined);
      }
    }
    
    if (!fs.existsSync(mockDataPath)) {
      return res.json({
        totalFiles: 0,
        totalSize: 0,
        endpoints: [],
        domains: {},
        methods: {},
        statusCodes: {},
        recentActivity: [],
        folderBreakdown: [],
        scenario: currentScenario,
        mockDataPath: mockDataPath,
        scenarioPath: scenarioPath
      });
    }

    if (!fs.existsSync(scenarioPath)) {
      return res.json({
        totalFiles: 0,
        totalSize: 0,
        endpoints: [],
        domains: {},
        methods: {},
        statusCodes: {},
        recentActivity: [],
        folderBreakdown: [],
        scenario: currentScenario,
        mockDataPath: mockDataPath,
        scenarioPath: scenarioPath
      });
    }

    const filePaths = getAllJsonFiles(scenarioPath);

    let totalSize = 0;
    const endpoints: Record<string, number> = {};
    const domains: Record<string, number> = {};
    const methods: Record<string, number> = {};
    const statusCodes: Record<string, number> = {};
    const folderCounts: Record<string, number> = {};
    const recentActivity: Array<{ filename: string; modified: Date }> = [];

    filePaths.forEach((filePath) => {
      const relativeName = path.relative(scenarioPath, filePath).split(path.sep).join('/');
      const dir = path.dirname(relativeName).split(path.sep).join('/');
      const folderKey = dir === '.' ? '' : dir;
      folderCounts[folderKey] = (folderCounts[folderKey] || 0) + 1;

      const stats = fs.statSync(filePath);
      totalSize += stats.size;

      recentActivity.push({
        filename: relativeName,
        modified: stats.mtime
      });

      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const mockData = JSON.parse(fileContent);
        
        if (mockData.request) {
          // Count endpoints
          const endpoint = mockData.request.url || 'unknown';
          endpoints[endpoint] = (endpoints[endpoint] || 0) + 1;
          
          // Count methods
          const method = mockData.request.method || 'unknown';
          methods[method] = (methods[method] || 0) + 1;
          
          // Count domains
          try {
            const url = new URL(mockData.request.url);
            const domain = url.hostname;
            domains[domain] = (domains[domain] || 0) + 1;
          } catch (e) {
            // Invalid URL, skip
          }
        }
        
        if (mockData.response) {
          const status = String(mockData.response.status || 200);
          statusCodes[status] = (statusCodes[status] || 0) + 1;
        }
      } catch (error) {
        // Skip corrupted files
      }
    });

    // Sort recent activity by modified date
    recentActivity.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    
    // Get top endpoints
    const topEndpoints = Object.entries(endpoints)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));

    const folderBreakdown = Object.entries(folderCounts)
      .map(([folder, count]) => ({
        folder: folder === '' ? '(scenario root)' : folder,
        count,
      }))
      .sort((a, b) => a.folder.localeCompare(b.folder));

    res.json({
      totalFiles: filePaths.length,
      totalSize,
      endpoints: topEndpoints,
      domains,
      methods,
      statusCodes,
      recentActivity: recentActivity.slice(0, 10).map(item => ({
        filename: item.filename,
        modified: item.modified.toISOString()
      })),
      folderBreakdown,
      scenario: currentScenario,
      mockDataPath: mockDataPath,
      scenarioPath: scenarioPath
    });
  } catch (error: any) {
    console.error('[StatsRoute] Error:', error);
    res.status(500).json({ error: 'Failed to get statistics', details: error.message });
  }
});

export const statsRouter = router;

