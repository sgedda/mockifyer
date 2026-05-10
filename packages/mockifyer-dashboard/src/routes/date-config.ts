import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getCurrentScenario, getScenarioFolderPath, listScenarios, isScenarioLockedFs } from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import { RedisMockStore } from '../utils/redis-mock-store';

const router = express.Router();

const DATE_CONFIG_FILENAME = 'date-config.json';

/** HTTP 423 when scenario is locked — date manipulation writes are forbidden. */
const SCENARIO_DATE_LOCKED_MESSAGE = 'Scenario is locked; date settings cannot be changed.';

function sanitizeScenarioCandidate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const sanitized = trimmed.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (sanitized !== trimmed) return null;
  return sanitized;
}

async function resolveScenarioForRoute(
  mockDataPath: string,
  provider: 'filesystem' | 'sqlite' | 'redis',
  raw: string | undefined | null,
  redisStore: RedisMockStore | null
): Promise<string> {
  if (raw && typeof raw === 'string' && raw.trim()) {
    const s = sanitizeScenarioCandidate(raw);
    if (!s) {
      return provider === 'redis' && redisStore
        ? redisStore.getActiveScenario()
        : getCurrentScenario(mockDataPath);
    }
    if (provider === 'redis') {
      return s;
    }
    const scenarios = listScenarios(mockDataPath);
    if (scenarios.includes(s)) return s;
    return getCurrentScenario(mockDataPath);
  }
  if (provider === 'redis' && redisStore) {
    return redisStore.getActiveScenario();
  }
  return getCurrentScenario(mockDataPath);
}

function getDateConfigPathForScenario(mockDataPath: string, scenario: string): string {
  const folder = getScenarioFolderPath(mockDataPath, scenario);
  return path.join(folder, DATE_CONFIG_FILENAME);
}

function computeCurrentDate(dateManipulation: {
  fixedDate?: string | null;
  offset?: number;
  timezone?: string;
} | null): Date {
  if (!dateManipulation) {
    return new Date();
  }
  if (dateManipulation.fixedDate) {
    return new Date(dateManipulation.fixedDate);
  }
  if (dateManipulation.offset !== undefined && dateManipulation.offset !== null) {
    return new Date(Date.now() + dateManipulation.offset);
  }
  if (dateManipulation.timezone) {
    const date = new Date();
    try {
      return new Date(date.toLocaleString('en-US', { timeZone: dateManipulation.timezone }));
    } catch {
      return new Date();
    }
  }
  return new Date();
}

function loadMergedDateConfig(mockDataPath: string, scenario: string): {
  dateManipulation: Record<string, unknown> | null;
  source: 'scenario' | 'legacy' | 'none';
} {
  const scenarioPath = getDateConfigPathForScenario(mockDataPath, scenario);
  if (fs.existsSync(scenarioPath)) {
    try {
      const fileContent = fs.readFileSync(scenarioPath, 'utf-8');
      const config = JSON.parse(fileContent);
      const dm = config.dateManipulation ?? null;
      return { dateManipulation: dm, source: 'scenario' };
    } catch {
      return { dateManipulation: null, source: 'none' };
    }
  }

  const legacyPath = path.join(mockDataPath, DATE_CONFIG_FILENAME);
  if (fs.existsSync(legacyPath)) {
    try {
      const fileContent = fs.readFileSync(legacyPath, 'utf-8');
      const config = JSON.parse(fileContent);
      const dm = config.dateManipulation ?? null;
      return { dateManipulation: dm, source: 'legacy' };
    } catch {
      return { dateManipulation: null, source: 'none' };
    }
  }

  return { dateManipulation: null, source: 'none' };
}

function openRedisStore(mockDataPath: string, config: { redisUrl?: string; keyPrefix?: string }): RedisMockStore {
  return new RedisMockStore({
    redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
    keyPrefix: config.keyPrefix,
    mockDataPath,
  });
}

// Get current date config (per scenario; optional ?scenario=)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    const scenarioParam = typeof req.query.scenario === 'string' ? req.query.scenario : undefined;

    if (config.provider === 'redis') {
      const store = openRedisStore(mockDataPath, config);
      try {
        const scenario = await resolveScenarioForRoute(mockDataPath, config.provider, scenarioParam, store);
        const redisDoc = await store.getDateConfig(scenario);
        if (redisDoc !== null) {
          const dm = redisDoc.dateManipulation;
          const currentDate = computeCurrentDate(dm as Record<string, unknown> | null);
          console.log('[DateConfigRoute] GET - scenario:', scenario, 'source: redis');
          return res.json({
            dateManipulation: dm,
            currentDate: currentDate.toISOString(),
            scenario,
            currentScenario: await store.getActiveScenario(),
            configSource: 'redis' as const,
            storage: 'redis' as const,
            redisKey: store.dateConfigRedisKey(scenario),
          });
        }
        // Redis is the sole source of truth in redis mode. No filesystem fallback —
        // a missing key means "no manipulation". This prevents stale `date-config.json`
        // files (e.g. in the consumer app's mock-data/) from leaking through the dashboard.
        const currentDate = new Date();
        console.log(
          '[DateConfigRoute] GET - scenario:',
          scenario,
          'source: none (redis miss; filesystem fallback disabled)'
        );
        return res.json({
          dateManipulation: null,
          currentDate: currentDate.toISOString(),
          scenario,
          currentScenario: await store.getActiveScenario(),
          configSource: 'none' as const,
          storage: 'redis' as const,
          redisKey: store.dateConfigRedisKey(scenario),
        });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const scenario = await resolveScenarioForRoute(mockDataPath, config.provider, scenarioParam, null);
    const { dateManipulation, source } = loadMergedDateConfig(mockDataPath, scenario);
    const currentDate = computeCurrentDate(dateManipulation as Record<string, unknown> | null);

    console.log('[DateConfigRoute] GET - scenario:', scenario, 'source:', source);

    res.json({
      dateManipulation,
      currentDate: currentDate.toISOString(),
      scenario,
      currentScenario: getCurrentScenario(mockDataPath),
      configSource: source,
      storage: 'filesystem' as const,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[DateConfigRoute] GET - Error:', error);
    res.status(500).json({ error: 'Failed to read date config', details: message });
  }
});

// Update date config for a scenario (body.scenario optional; defaults to active)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { fixedDate, offset, timezone, scenario: bodyScenario } = req.body as {
      fixedDate?: string | null;
      offset?: number | null;
      timezone?: string | null;
      scenario?: string | null;
    };
    const { mockDataPath, config } = getDashboardContext(req);

    if (fixedDate !== undefined && fixedDate !== null && fixedDate !== '') {
      const testDate = new Date(fixedDate);
      if (isNaN(testDate.getTime())) {
        return res.status(400).json({
          error: 'Invalid date format. Use ISO 8601 format (e.g., 2024-12-25T00:00:00.000Z)',
        });
      }
    }

    if (offset !== undefined && offset !== null && typeof offset !== 'number') {
      return res.status(400).json({ error: 'Offset must be a number (milliseconds)' });
    }

    const dateManipulation: Record<string, unknown> = {};

    if (fixedDate !== undefined && fixedDate !== null && fixedDate !== '') {
      dateManipulation.fixedDate = fixedDate;
    } else if (offset !== undefined && offset !== null && offset !== 0) {
      // offset === 0 is the same as "no offset" — treat as clear so we do not persist a no-op override
      dateManipulation.offset = offset;
    } else {
      dateManipulation.fixedDate = null;
      dateManipulation.offset = undefined;
    }

    if (timezone !== undefined && timezone !== null && timezone !== '') {
      dateManipulation.timezone = timezone;
    }

    const noManipulation =
      !dateManipulation.fixedDate &&
      dateManipulation.offset === undefined &&
      !dateManipulation.timezone;

    if (config.provider === 'redis') {
      const store = openRedisStore(mockDataPath, config);
      try {
        const scenario = await resolveScenarioForRoute(mockDataPath, config.provider, bodyScenario ?? undefined, store);

        if (await store.isScenarioLocked(scenario)) {
          return res.status(423).json({ error: SCENARIO_DATE_LOCKED_MESSAGE });
        }

        if (noManipulation) {
          // Keep an explicit empty Redis document so GET does not fall through to legacy root date-config.json.
          const clearedAt = new Date().toISOString();
          await store.setDateConfig(scenario, {
            dateManipulation: {},
            updatedAt: clearedAt,
          });
          const scenarioFsPath = getDateConfigPathForScenario(mockDataPath, scenario);
          if (fs.existsSync(scenarioFsPath)) {
            fs.unlinkSync(scenarioFsPath);
          }
          return res.json({
            success: true,
            message:
              'Date manipulation cleared for this scenario (empty override stored in Redis). Legacy root date-config.json is ignored while this scenario key exists.',
            dateManipulation: {},
            currentDate: computeCurrentDate({}).toISOString(),
            scenario,
            currentScenario: await store.getActiveScenario(),
            configSource: 'redis' as const,
            storage: 'redis' as const,
            redisKey: store.dateConfigRedisKey(scenario),
          });
        }

        const payload = {
          dateManipulation,
          updatedAt: new Date().toISOString(),
        };
        await store.setDateConfig(scenario, payload);

        const currentDate = computeCurrentDate(dateManipulation as Record<string, unknown> | null);

        console.log(`[DateConfigRoute] Updated Redis date config for scenario "${scenario}":`, dateManipulation);

        return res.json({
          success: true,
          message: 'Date manipulation updated successfully',
          dateManipulation,
          currentDate: currentDate.toISOString(),
          scenario,
          currentScenario: await store.getActiveScenario(),
          configSource: 'redis' as const,
          storage: 'redis' as const,
          redisKey: store.dateConfigRedisKey(scenario),
        });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const scenario = await resolveScenarioForRoute(mockDataPath, config.provider, bodyScenario ?? undefined, null);

    if (isScenarioLockedFs(mockDataPath, scenario)) {
      return res.status(423).json({ error: SCENARIO_DATE_LOCKED_MESSAGE });
    }

    const scenarioFolder = getScenarioFolderPath(mockDataPath, scenario);
    const configPath = path.join(scenarioFolder, DATE_CONFIG_FILENAME);

    if (!fs.existsSync(mockDataPath)) {
      fs.mkdirSync(mockDataPath, { recursive: true });
    }
    if (!fs.existsSync(scenarioFolder)) {
      fs.mkdirSync(scenarioFolder, { recursive: true });
    }

    if (noManipulation) {
      // Write an explicit empty scenario file so load does not fall back to legacy root date-config.json.
      const clearedPayload = {
        dateManipulation: {} as Record<string, unknown>,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(configPath, JSON.stringify(clearedPayload, null, 2), 'utf-8');
      return res.json({
        success: true,
        message: 'Date manipulation cleared for scenario (empty override saved; legacy root no longer applies for this scenario).',
        dateManipulation: {},
        currentDate: computeCurrentDate({}).toISOString(),
        scenario,
        currentScenario: getCurrentScenario(mockDataPath),
        configSource: 'scenario' as const,
        storage: 'filesystem' as const,
      });
    }

    const payloadFs = {
      dateManipulation,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(configPath, JSON.stringify(payloadFs, null, 2), 'utf-8');

    const currentDate = computeCurrentDate(dateManipulation as Record<string, unknown> | null);

    console.log(`[DateConfigRoute] Updated date config for scenario "${scenario}":`, dateManipulation);

    res.json({
      success: true,
      message: 'Date manipulation updated successfully',
      dateManipulation,
      currentDate: currentDate.toISOString(),
      scenario,
      currentScenario: getCurrentScenario(mockDataPath),
      configSource: 'scenario' as const,
      storage: 'filesystem' as const,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[DateConfigRoute] Update - Error:', error);
    res.status(500).json({ error: 'Failed to update date config', details: message });
  }
});

export const dateConfigRouter = router;
