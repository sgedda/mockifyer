import express, { Request, Response } from 'express';
import { getDashboardContext } from '../utils/dashboard-context';
import { createDashboardMockStore } from '../utils/create-dashboard-mock-store';
import { isCentralizedDashboardProvider } from '../utils/dashboard-provider';
import { buildClientConnectionRows } from '../utils/client-connections';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    if (!isCentralizedDashboardProvider(config.provider)) {
      return res.json({
        enabled: false,
        reason: "Client lanes are only available when the dashboard provider is 'redis' or 'sqlite'.",
        lanes: [],
        discoveredLanes: [],
        connections: [],
        globalScenario: null,
      });
    }

    const store = createDashboardMockStore(config, mockDataPath);
    try {
      const lanes = await store.listClientLanes();
      const lanesWithDevices = await Promise.all(
        lanes.map(async (lane) => {
          const devices = await store.listLaneDevices(lane.clientId, 10).catch(() => []);
          const deviceCount = await store.countLaneDevices(lane.clientId).catch(() => 0);
          const laneEffective = await store.readLaneLastResolved(lane.clientId).catch(() => null);
          return {
            ...lane,
            lastSeenResolved: laneEffective
              ? {
                  scenario: laneEffective.lastEffectiveScenario,
                  lastSeenAt: laneEffective.lastSeenAt,
                  resolutionSource: laneEffective.resolutionSource,
                  clientBodyScenarioOverride: laneEffective.clientBodyScenarioOverride,
                }
              : null,
            devices: {
              count: deviceCount,
              recent: await Promise.all(
                devices.map(async (d) => {
                  const de = await store.readDeviceLastResolved(lane.clientId, d.deviceId).catch(() => null);
                  return {
                    deviceId: d.deviceId,
                    lastSeenAt: new Date(d.lastSeenMs).toISOString(),
                    lastSeenResolved: de
                      ? {
                          scenario: de.lastEffectiveScenario,
                          lastSeenAt: de.lastSeenAt,
                          resolutionSource: de.resolutionSource,
                          clientBodyScenarioOverride: de.clientBodyScenarioOverride,
                        }
                      : null,
                  };
                })
              ),
            },
          };
        })
      );
      const discoveredDetailed = await store.listDiscoveredLanesDetailed();
      const discoveredLanes = discoveredDetailed.map((d) => d.clientId);
      const globalScenario = await store.getActiveScenario();
      const connections = buildClientConnectionRows(lanesWithDevices, discoveredDetailed);
      return res.json({
        enabled: true,
        lanes: lanesWithDevices,
        discoveredLanes,
        connections,
        globalScenario,
      });
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
    if (!isCentralizedDashboardProvider(config.provider)) {
      return res.status(400).json({ error: "client lanes require dashboard provider 'redis'." });
    }
    const canonicalClientId = typeof clientId === 'string' ? clientId.trim() : '';
    if (!canonicalClientId) return res.status(400).json({ error: 'clientId is required' });

    const scenarioValue =
      scenario === null
        ? null
        : typeof scenario === 'string' && scenario.trim()
          ? scenario.trim()
          : undefined;
    if (scenarioValue === undefined) {
      return res.status(400).json({ error: 'scenario must be a non-empty string or null' });
    }

    const store = createDashboardMockStore(config, mockDataPath);
    try {
      await store.setLaneScenario(canonicalClientId, scenarioValue);
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
    if (!isCentralizedDashboardProvider(config.provider)) {
      return res.status(400).json({ error: "client lanes require dashboard provider 'redis'." });
    }
    const canonicalClientId = typeof clientId === 'string' ? clientId.trim() : '';
    if (!canonicalClientId) return res.status(400).json({ error: 'clientId is required' });

    const noteValue =
      note === null
        ? null
        : typeof note === 'string'
          ? note
          : undefined;
    if (noteValue === undefined) {
      return res.status(400).json({ error: 'note must be a string or null' });
    }

    const store = createDashboardMockStore(config, mockDataPath);
    try {
      await store.setLaneNote(canonicalClientId, noteValue);
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

