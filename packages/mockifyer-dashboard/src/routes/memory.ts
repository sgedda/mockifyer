import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getCurrentScenario, getScenarioFolderPath } from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import { createDashboardMockStore } from '../utils/create-dashboard-mock-store';
import { isCentralizedDashboardProvider } from '../utils/dashboard-provider';
import { getAllJsonFiles } from '../utils/json-files';
import { parseMockJsonForCatalog } from '../utils/mock-json-catalog';
import { createNetworkLogStore } from '../utils/network-log-store';

const router = express.Router();

interface ScenarioMemoryStats {
  scenario: string;
  mocksCount: number;
  mocksSize: number;
  networkEventsCount: number;
  networkEventsSize: number;
  totalSize: number;
}

async function getFilesystemScenarioStats(
  scenarioPath: string,
  scenario: string,
  config: any
): Promise<ScenarioMemoryStats> {
  let mocksCount = 0;
  let mocksSize = 0;

  if (fs.existsSync(scenarioPath)) {
    const filePaths = getAllJsonFiles(scenarioPath);
    filePaths.forEach((filePath) => {
      try {
        const stats = fs.statSync(filePath);
        mocksCount++;
        mocksSize += stats.size;
      } catch {
        // Skip files we can't read
      }
    });
  }

  let networkEventsCount = 0;
  let networkEventsSize = 0;

  const store = createNetworkLogStore(config);
  try {
    const { events } = await store.list({ scenario, limit: 10000 });
    networkEventsCount = events.length;
    networkEventsSize = JSON.stringify(events).length;
  } catch {
    // Network events might not be available
  } finally {
    await store.close().catch(() => undefined);
  }

  return {
    scenario,
    mocksCount,
    mocksSize,
    networkEventsCount,
    networkEventsSize,
    totalSize: mocksSize + networkEventsSize,
  };
}

async function getRedisScenarioStats(
  scenario: string,
  config: any,
  mockDataPath: string
): Promise<ScenarioMemoryStats> {
  const store = createDashboardMockStore(config, mockDataPath);
  let mocksCount = 0;
  let mocksSize = 0;

  try {
    const items = await store.listCatalog(scenario);
    for (const { rawByteLength } of items) {
      mocksCount++;
      mocksSize += rawByteLength ?? 0;
    }
  } finally {
    await store.close().catch(() => undefined);
  }

  let networkEventsCount = 0;
  let networkEventsSize = 0;

  const networkStore = createNetworkLogStore(config);
  try {
    const { events } = await networkStore.list({ scenario, limit: 10000 });
    networkEventsCount = events.length;
    networkEventsSize = JSON.stringify(events).length;
  } catch {
    // Network events might not be available
  } finally {
    await networkStore.close().catch(() => undefined);
  }

  return {
    scenario,
    mocksCount,
    mocksSize,
    networkEventsCount,
    networkEventsSize,
    totalSize: mocksSize + networkEventsSize,
  };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    const requestedScenario = req.query.scenario as string | undefined;
    const currentScenario = requestedScenario || getCurrentScenario(mockDataPath);

    const isRedis = isCentralizedDashboardProvider(config.provider);

    let scenarios: string[] = [];

    if (isRedis) {
      const store = createDashboardMockStore(config, mockDataPath);
      try {
        scenarios = await store.listScenarios();
      } finally {
        await store.close().catch(() => undefined);
      }
    } else {
      if (fs.existsSync(mockDataPath)) {
        const entries = fs.readdirSync(mockDataPath, { withFileTypes: true });
        scenarios = entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .filter((name) => !name.startsWith('.'));
      }
    }

    const scenarioStats: ScenarioMemoryStats[] = [];

    for (const scenario of scenarios) {
      if (isRedis) {
        const stats = await getRedisScenarioStats(scenario, config, mockDataPath);
        scenarioStats.push(stats);
      } else {
        const scenarioPath = path.resolve(getScenarioFolderPath(mockDataPath, scenario));
        const stats = await getFilesystemScenarioStats(scenarioPath, scenario, config);
        scenarioStats.push(stats);
      }
    }

    scenarioStats.sort((a, b) => b.totalSize - a.totalSize);

    const totalMocksCount = scenarioStats.reduce((sum, s) => sum + s.mocksCount, 0);
    const totalMocksSize = scenarioStats.reduce((sum, s) => sum + s.mocksSize, 0);
    const totalNetworkEventsCount = scenarioStats.reduce((sum, s) => sum + s.networkEventsCount, 0);
    const totalNetworkEventsSize = scenarioStats.reduce((sum, s) => sum + s.networkEventsSize, 0);
    const totalSize = scenarioStats.reduce((sum, s) => sum + s.totalSize, 0);

    res.json({
      currentScenario,
      scenarios: scenarioStats,
      summary: {
        totalMocksCount,
        totalMocksSize,
        totalNetworkEventsCount,
        totalNetworkEventsSize,
        totalSize,
      },
    });
  } catch (error: any) {
    console.error('[MemoryRoute] Error:', error);
    res.status(500).json({ error: 'Failed to get memory statistics', details: error.message });
  }
});

export const memoryRouter = router;
