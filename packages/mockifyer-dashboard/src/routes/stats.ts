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
  filterByStatsDomain,
  leafResponses,
  matchesStatsDomain,
  rankLargestResponses,
  rankRecentActivity,
  rankSlowestResponses,
  readEndpointHostname,
  toRankedResponseStat,
  toRecentActivityStat,
  type RankedResponseStat,
  type RecentActivityStat,
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
    recentActivity: [] as RecentActivityStat[],
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
    const requestedDomain = typeof req.query.domain === 'string' ? req.query.domain.trim() : '';

    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);

      try {
        const items = await store.listCatalog(currentScenario);
        let matchingFiles = 0;
        let totalSize = 0;
        const endpoints: Record<string, number> = {};
        const domains: Record<string, number> = {};
        const methods: Record<string, number> = {};
        const statusCodes: Record<string, number> = {};
        const recentActivity: RecentActivityStat[] = [];
        const ranked: RankedResponseStat[] = [];
        const replayModes = emptyReplayModeBreakdown();

        for (const { hash, mockData, rawByteLength } of items) {
          const size = rawByteLength ?? 0;
          const filename = `redis/${hash}.json`;
          const endpoint = mockData.request?.url || '';
          const host = readEndpointHostname(endpoint);
          if (host) domains[host] = (domains[host] || 0) + 1;
          ranked.push(toRankedResponseStat({ filename, mockData, size }));
          if (!matchesStatsDomain(endpoint, requestedDomain)) continue;

          matchingFiles += 1;
          totalSize += size;
          const ts = mockData.timestamp ? new Date(mockData.timestamp) : new Date();
          recentActivity.push(toRecentActivityStat({ filename, mockData, modified: ts }));
          addReplayModeCount(replayModes, mockData);

          if (mockData.request) {
            const requestUrl = mockData.request.url || 'unknown';
            endpoints[requestUrl] = (endpoints[requestUrl] || 0) + 1;
            const method = (mockData.request.method || 'unknown').toUpperCase();
            methods[method] = (methods[method] || 0) + 1;
          }
          if ((mockData as any).response) {
            const status = String((mockData as any).response?.status || 200);
            statusCodes[status] = (statusCodes[status] || 0) + 1;
          }
        }

        const topEndpoints = Object.entries(endpoints)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([endpoint, count]) => ({ endpoint, count }));
        const domainLeaves = filterByStatsDomain(leafResponses(ranked), requestedDomain);

        return res.json({
          totalFiles: matchingFiles,
          totalSize,
          endpoints: topEndpoints,
          domains,
          methods,
          statusCodes,
          recentActivity: rankRecentActivity(recentActivity),
          folderBreakdown: [],
          slowestResponses: rankSlowestResponses(domainLeaves),
          largestResponses: rankLargestResponses(domainLeaves),
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

    let matchingFiles = 0;
    let totalSize = 0;
    const endpoints: Record<string, number> = {};
    const domains: Record<string, number> = {};
    const methods: Record<string, number> = {};
    const statusCodes: Record<string, number> = {};
    const folderCounts: Record<string, number> = {};
    const recentActivity: RecentActivityStat[] = [];
    const ranked: RankedResponseStat[] = [];
    const replayModes = emptyReplayModeBreakdown();

    filePaths.forEach((filePath) => {
      const relativeName = path.relative(scenarioPath, filePath).split(path.sep).join('/');
      const dir = path.dirname(relativeName).split(path.sep).join('/');
      const folderKey = dir === '.' ? '' : dir;
      const stats = fs.statSync(filePath);

      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const { mockData } = parseMockJsonForCatalog(raw);
        const endpoint = mockData.request?.url || '';
        const host = readEndpointHostname(endpoint);
        if (host) domains[host] = (domains[host] || 0) + 1;
        ranked.push(
          toRankedResponseStat({ filename: relativeName, mockData, size: stats.size })
        );
        if (!matchesStatsDomain(endpoint, requestedDomain)) return;

        matchingFiles += 1;
        totalSize += stats.size;
        folderCounts[folderKey] = (folderCounts[folderKey] || 0) + 1;
        addReplayModeCount(replayModes, mockData);
        const modified = mockData.timestamp ? new Date(mockData.timestamp) : stats.mtime;
        recentActivity.push(
          toRecentActivityStat({ filename: relativeName, mockData, modified })
        );

        if (mockData.request) {
          const requestUrl = mockData.request.url || 'unknown';
          endpoints[requestUrl] = (endpoints[requestUrl] || 0) + 1;
          const method = mockData.request.method || 'unknown';
          methods[method] = (methods[method] || 0) + 1;
        }

        if (mockData.response) {
          const status = String(mockData.response.status || 200);
          statusCodes[status] = (statusCodes[status] || 0) + 1;
        }
      } catch (error) {
        // Skip corrupted files
      }
    });

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

    const domainLeaves = filterByStatsDomain(leafResponses(ranked), requestedDomain);

    res.json({
      totalFiles: matchingFiles,
      totalSize,
      endpoints: topEndpoints,
      domains,
      methods,
      statusCodes,
      recentActivity: rankRecentActivity(recentActivity),
      folderBreakdown,
      slowestResponses: rankSlowestResponses(domainLeaves),
      largestResponses: rankLargestResponses(domainLeaves),
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
