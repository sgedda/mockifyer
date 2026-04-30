import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { detectMockDataPath } from '../utils/path-detector';
import { getCurrentScenario, getScenarioFolderPath, listScenarios } from '@sgedda/mockifyer-core';

const router = express.Router();

const DATE_CONFIG_FILENAME = 'date-config.json';

function getMockDataPath(): string {
  try {
    return detectMockDataPath();
  } catch (error: unknown) {
    console.error('[DateConfigRoute] Error detecting mock data path:', error);
    return path.join(process.cwd(), 'mock-data');
  }
}

/** Resolve scenario: query/body, validated against existing folders when possible */
function resolveScenario(mockDataPath: string, raw?: string | null): string {
  if (raw && typeof raw === 'string' && raw.trim() !== '') {
    const trimmed = raw.trim();
    const sanitized = trimmed.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (sanitized !== trimmed) {
      return getCurrentScenario(mockDataPath);
    }
    const scenarios = listScenarios(mockDataPath);
    if (scenarios.includes(sanitized)) {
      return sanitized;
    }
    return getCurrentScenario(mockDataPath);
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

/**
 * Load date config for a scenario: per-scenario file first, then legacy root mock-data/date-config.json.
 * If the scenario directory or `{scenario}/date-config.json` is missing, reads legacy root only.
 */
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

// Get current date config (per scenario; optional ?scenario=)
router.get('/', (req: Request, res: Response) => {
  try {
    const mockDataPath = getMockDataPath();
    const scenarioParam = typeof req.query.scenario === 'string' ? req.query.scenario : undefined;
    const scenario = resolveScenario(mockDataPath, scenarioParam);

    const { dateManipulation, source } = loadMergedDateConfig(mockDataPath, scenario);
    const currentDate = computeCurrentDate(dateManipulation);

    console.log('[DateConfigRoute] GET - scenario:', scenario, 'source:', source);

    res.json({
      dateManipulation,
      currentDate: currentDate.toISOString(),
      scenario,
      currentScenario: getCurrentScenario(mockDataPath),
      configSource: source,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[DateConfigRoute] GET - Error:', error);
    res.status(500).json({ error: 'Failed to read date config', details: message });
  }
});

// Update date config for a scenario (body.scenario optional; defaults to current)
router.post('/', (req: Request, res: Response) => {
  try {
    const { fixedDate, offset, timezone, scenario: bodyScenario } = req.body as {
      fixedDate?: string | null;
      offset?: number | null;
      timezone?: string | null;
      scenario?: string | null;
    };
    const mockDataPath = getMockDataPath();
    const scenario = resolveScenario(mockDataPath, bodyScenario ?? undefined);

    const scenarioFolder = getScenarioFolderPath(mockDataPath, scenario);
    const configPath = path.join(scenarioFolder, DATE_CONFIG_FILENAME);

    // Create mock-data and scenario folder on first save (no need for them to exist when only reading)
    if (!fs.existsSync(mockDataPath)) {
      fs.mkdirSync(mockDataPath, { recursive: true });
    }
    if (!fs.existsSync(scenarioFolder)) {
      fs.mkdirSync(scenarioFolder, { recursive: true });
    }

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
    } else if (offset !== undefined && offset !== null) {
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

    if (noManipulation) {
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
      const { dateManipulation: dm, source } = loadMergedDateConfig(mockDataPath, scenario);
      return res.json({
        success: true,
        message: 'Date manipulation cleared for scenario',
        dateManipulation: dm,
        currentDate: computeCurrentDate(dm).toISOString(),
        scenario,
        currentScenario: getCurrentScenario(mockDataPath),
        configSource: source,
      });
    }

    const config = {
      dateManipulation,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

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
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[DateConfigRoute] Update - Error:', error);
    res.status(500).json({ error: 'Failed to update date config', details: message });
  }
});

export const dateConfigRouter = router;
