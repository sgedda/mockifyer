import express, { Request, Response } from 'express';
import { getCurrentScenario } from '@sgedda/mockifyer-core';
import {
  checkDrift,
  loadDriftHistory,
  acceptDrift,
  acceptAllWarnings,
  snoozeEndpoint,
  addIgnoreField,
  type DriftHistoryReport,
  type DriftCheckOptions,
} from '@sgedda/mockifyer-core/utils/drift';
import { getDashboardContext } from '../utils/dashboard-context';
import * as fs from 'fs';
import * as path from 'path';

const router = express.Router();

function resolveScenario(req: Request, mockDataPath: string): string {
  const q = req.query.scenario;
  if (typeof q === 'string' && q.trim()) return q.trim();
  const bodyScenario = req.body?.scenario;
  if (typeof bodyScenario === 'string' && bodyScenario.trim()) return bodyScenario.trim();
  return getCurrentScenario(mockDataPath);
}

/**
 * GET /drift/latest — Get the latest drift report for a scenario
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const scenario = resolveScenario(req, mockDataPath);

    const history = loadDriftHistory(mockDataPath, scenario);

    if (!history) {
      return res.json({
        scenario,
        found: false,
        message: 'No drift report found. Run drift check first.',
      });
    }

    return res.json({
      scenario,
      found: true,
      report: history,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load drift report',
    });
  }
});

/**
 * GET /drift/history — Get all drift history reports for a scenario
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const scenario = resolveScenario(req, mockDataPath);

    const driftDir = path.join(mockDataPath, scenario, '.drift');

    if (!fs.existsSync(driftDir)) {
      return res.json({
        scenario,
        reports: [],
      });
    }

    const files = fs.readdirSync(driftDir)
      .filter((f) => f.endsWith('.json') && f !== 'latest.json')
      .map((f) => {
        const filePath = path.join(driftDir, f);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return {
          timestamp: content.timestamp,
          breakingDriftCount: content.breakingDriftCount,
          warningOnlyCount: content.warningOnlyCount,
          totalMocks: content.totalMocks,
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.json({
      scenario,
      reports: files,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load drift history',
    });
  }
});

/**
 * POST /drift/check — Run drift check now (GET-only, against configured base URL)
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const scenario = resolveScenario(req, mockDataPath);

    const driftOptions: DriftCheckOptions = {
      allowUnsafeMethods: false,
      concurrency: 5,
      timeoutMs: 10000,
    };

    const report = await checkDrift({
      scenario,
      mockDataPath,
      driftOptions,
    });

    return res.json({
      success: true,
      report,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to run drift check',
    });
  }
});

/**
 * POST /drift/accept — Accept drift for one endpoint
 */
router.post('/accept', async (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const scenario = resolveScenario(req, mockDataPath);
    const { method, path: urlPath } = req.body;

    if (!method || !urlPath) {
      return res.status(400).json({
        error: 'Missing required fields: method and path',
      });
    }

    const result = await acceptDrift({
      method,
      path: urlPath,
      mockDataPath,
      scenario,
      driftOptions: {
        allowUnsafeMethods: false,
      },
    });

    return res.json(result);
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to accept drift',
    });
  }
});

/**
 * POST /drift/accept-all-warnings — Accept all endpoints with warnings only
 */
router.post('/accept-all-warnings', async (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const scenario = resolveScenario(req, mockDataPath);

    const result = await acceptAllWarnings({
      mockDataPath,
      scenario,
      driftOptions: {
        allowUnsafeMethods: false,
      },
    });

    return res.json(result);
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to accept warnings',
    });
  }
});

/**
 * POST /drift/snooze — Snooze an endpoint for N days
 */
router.post('/snooze', async (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const scenario = resolveScenario(req, mockDataPath);
    const { method, path: urlPath, days = 7 } = req.body;

    if (!method || !urlPath) {
      return res.status(400).json({
        error: 'Missing required fields: method and path',
      });
    }

    const result = await snoozeEndpoint({
      method,
      path: urlPath,
      days,
      mockDataPath,
      scenario,
    });

    return res.json(result);
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to snooze endpoint',
    });
  }
});

/**
 * POST /drift/ignore-field — Add ignore path for a specific endpoint
 */
router.post('/ignore-field', async (req: Request, res: Response) => {
  try {
    const { endpoint, jsonPath } = req.body;

    if (!endpoint || !jsonPath) {
      return res.status(400).json({
        error: 'Missing required fields: endpoint and jsonPath',
      });
    }

    const result = await addIgnoreField({
      endpoint,
      jsonPath,
      configPath: path.join(process.cwd(), 'mockifyer.drift.json'),
    });

    return res.json(result);
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to add ignore field',
    });
  }
});

export default router;
