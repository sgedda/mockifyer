import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { detectMockDataPath } from '../utils/path-detector';
import { getAllJsonFiles } from '../utils/json-files';
import { getCurrentScenario, getScenarioFolderPath } from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import { createDashboardMockStore } from '../utils/create-dashboard-mock-store';
import { isCentralizedDashboardProvider } from '../utils/dashboard-provider';
import { parseMockJsonForCatalog } from '../utils/mock-json-catalog';
import {
  addReplayModeCount,
  emptyReplayModeBreakdown,
  leafResponses,
  rankLargestResponses,
  rankSlowestResponses,
  toRankedResponseStat,
  type RankedResponseStat,
} from '../utils/stats-rankings';

const router = express.Router();

function emptyStats(params: {
  scenario: string;
  mockDataPath: string;
  scenarioPath: string;
}) {
  return {
    totalFiles: 0,
    totalSize: 0,
    endpoints: [] as Array<{ endpoint: string; count: number }>,
    domains: {} as Record<string, number>,
    methods: {} as Record<string, number>,
    statusCodes: {} as Record<string, number>,
    recentActivity: [] as Array<{ filename: string; modified: string }>,
    folderBreakdown: [] as Array<{ folder: string; count: number }>,
    slowestResponses: [] as RankedResponseStat[],
    largestResponses: [] as RankedResponseStat[],
    replayModes: emptyReplayModeBreakdown(),
    scenario: params.scenario,
    mockDataPath: params.mockDataPath,
    scenarioPath: params.scenarioPath,
  };
}

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

    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);

      try {
        const items = await store.listCatalog(currentScenario);
        let totalSize = 0;
        const endpoints: Record<string, number> = {};
        const domains: Record<string, number> = {};
        const methods: Record<string, number> = {};
        const statusCodes: Record<string, number> = {};
        const recentActivity: Array<{ filename: string; modified: Date }> = [];
        const ranked: RankedResponseStat[] = [];
        const replayModes = emptyReplayModeBreakdown();

        for (const { hash, mockData, rawByteLength } of items) {
          const size = rawByteLength ?? 0;
          totalSize += size;
          const filename = `redis/${hash}.json`;
          const ts = mockData.timestamp ? new Date(mockData.timestamp) : new Date();
          recentActivity.push({ filename, modified: ts });
          ranked.push(toRankedResponseStat({ filename, mockData, size }));
          addReplayModeCount(replayModes, mockData);

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
          slowestResponses: rankSlowestResponses(leafResponses(ranked)),
          largestResponses: rankLargestResponses(leafResponses(ranked)),
          replayModes,
          scenario: currentScenario,
          mockDataPath,
          scenarioPath: `redis://${config.keyPrefix || 'mockifyer:v1'}:index:${currentScenario}`,
        });
      } finally {
        await store.close().catch(() => undefined);
      }
    }
    
    if (!fs.existsSync(mockDataPath)) {
      return res.json(
        emptyStats({ scenario: currentScenario, mockDataPath, scenarioPath })
      );
    }

    if (!fs.existsSync(scenarioPath)) {
      return res.json(
        emptyStats({ scenario: currentScenario, mockDataPath, scenarioPath })
      );
    }

    const filePaths = getAllJsonFiles(scenarioPath);

    let totalSize = 0;
    const endpoints: Record<string, number> = {};
    const domains: Record<string, number> = {};
    const methods: Record<string, number> = {};
    const statusCodes: Record<string, number> = {};
    const folderCounts: Record<string, number> = {};
    const recentActivity: Array<{ filename: string; modified: Date }> = [];
    const ranked: RankedResponseStat[] = [];
    const replayModes = emptyReplayModeBreakdown();

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
        const raw = fs.readFileSync(filePath, 'utf-8');
        const { mockData } = parseMockJsonForCatalog(raw);
        ranked.push(
          toRankedResponseStat({ filename: relativeName, mockData, size: stats.size })
        );
        addReplayModeCount(replayModes, mockData);
        
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
      slowestResponses: rankSlowestResponses(leafResponses(ranked)),
      largestResponses: rankLargestResponses(leafResponses(ranked)),
      replayModes,
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
