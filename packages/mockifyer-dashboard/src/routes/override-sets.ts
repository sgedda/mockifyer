import express, { Request, Response } from 'express';
import {
  DEFAULT_OVERRIDE_SET_ID,
  createEmptyOverrideSetDocument,
  deleteOverrideSetFromFs,
  listOverrideSetsFromFs,
  normalizeOverrideSetId,
  parseOverrideSetDocument,
  readOverrideSetFromFs,
  upsertOverrideSetEntry,
  writeOverrideSetToFs,
  type OverrideSetDocument,
  type OverrideSetEntry,
} from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import { createDashboardMockStore } from '../utils/create-dashboard-mock-store';
import { isCentralizedDashboardProvider } from '../utils/dashboard-provider';

const router = express.Router();

function requireScenario(req: Request): string {
  const fromQuery = typeof req.query.scenario === 'string' ? req.query.scenario.trim() : '';
  const fromBody =
    req.body && typeof (req.body as { scenario?: unknown }).scenario === 'string'
      ? String((req.body as { scenario: string }).scenario).trim()
      : '';
  const scenario = fromQuery || fromBody;
  if (!scenario) {
    throw Object.assign(new Error('scenario query/body parameter is required'), { status: 400 });
  }
  return scenario;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const scenario = requireScenario(req);
    const { mockDataPath, config } = getDashboardContext(req);

    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);
      try {
        const sets = await store.listOverrideSets(scenario);
        return res.json({ scenario, sets });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const sets = listOverrideSetsFromFs(mockDataPath, scenario);
    return res.json({ scenario, sets });
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status ?? 500;
    const message = error instanceof Error ? error.message : String(error);
    if (status !== 500) {
      return res.status(status).json({ error: message });
    }
    console.error('[OverrideSetsRoute] List - Error:', error);
    return res.status(500).json({ error: 'Failed to list override sets', details: message });
  }
});

router.get('/:setId', async (req: Request, res: Response) => {
  try {
    const scenario = requireScenario(req);
    const setId = normalizeOverrideSetId(req.params.setId);
    const { mockDataPath, config } = getDashboardContext(req);

    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);
      try {
        const document = await store.getOverrideSet(scenario, setId);
        return res.json({ scenario, document });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const document = readOverrideSetFromFs(mockDataPath, scenario, setId);
    return res.json({ scenario, document });
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status ?? 500;
    const message = error instanceof Error ? error.message : String(error);
    if (status !== 500) {
      return res.status(status).json({ error: message });
    }
    console.error('[OverrideSetsRoute] Get - Error:', error);
    return res.status(500).json({ error: 'Failed to get override set', details: message });
  }
});

router.put('/:setId', async (req: Request, res: Response) => {
  try {
    const scenario = requireScenario(req);
    const setId = normalizeOverrideSetId(req.params.setId);
    const { mockDataPath, config } = getDashboardContext(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const document = parseOverrideSetDocument(
      {
        id: setId,
        label: body.label,
        updatedAt: body.updatedAt,
        entries: body.entries ?? {},
      },
      setId
    );

    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);
      try {
        const saved = await store.putOverrideSet(scenario, document);
        return res.json({ success: true, scenario, document: saved });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const saved = writeOverrideSetToFs(mockDataPath, scenario, document);
    return res.json({ success: true, scenario, document: saved });
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status ?? 500;
    const message = error instanceof Error ? error.message : String(error);
    if (status !== 500) {
      return res.status(status).json({ error: message });
    }
    console.error('[OverrideSetsRoute] Put - Error:', error);
    return res.status(500).json({ error: 'Failed to save override set', details: message });
  }
});

router.put('/:setId/entries/:hash', async (req: Request, res: Response) => {
  try {
    const scenario = requireScenario(req);
    const setId = normalizeOverrideSetId(req.params.setId);
    const hash = String(req.params.hash || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      return res.status(400).json({ error: 'hash must be a 64-char hex SHA-256 digest' });
    }
    const { mockDataPath, config } = getDashboardContext(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const clear = body.clear === true || body.entry === null;

    const load = async (): Promise<OverrideSetDocument> => {
      if (isCentralizedDashboardProvider(config.provider)) {
        const store = createDashboardMockStore(config, mockDataPath);
        try {
          return await store.getOverrideSet(scenario, setId);
        } finally {
          await store.close().catch(() => undefined);
        }
      }
      return readOverrideSetFromFs(mockDataPath, scenario, setId);
    };

    const save = async (document: OverrideSetDocument): Promise<OverrideSetDocument> => {
      if (isCentralizedDashboardProvider(config.provider)) {
        const store = createDashboardMockStore(config, mockDataPath);
        try {
          return await store.putOverrideSet(scenario, document);
        } finally {
          await store.close().catch(() => undefined);
        }
      }
      return writeOverrideSetToFs(mockDataPath, scenario, document);
    };

    const current = await load();
    const entry: OverrideSetEntry | null = clear
      ? null
      : {
          responseFieldOverrides: body.responseFieldOverrides as OverrideSetEntry['responseFieldOverrides'],
          responseDateOverrides: body.responseDateOverrides as OverrideSetEntry['responseDateOverrides'],
          filename: typeof body.filename === 'string' ? body.filename : undefined,
        };
    const next = upsertOverrideSetEntry(current, hash, entry);
    const saved = await save(next);
    return res.json({ success: true, scenario, document: saved, hash });
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status ?? 500;
    const message = error instanceof Error ? error.message : String(error);
    if (status !== 500) {
      return res.status(status).json({ error: message });
    }
    console.error('[OverrideSetsRoute] Upsert entry - Error:', error);
    return res.status(500).json({ error: 'Failed to upsert override set entry', details: message });
  }
});

router.delete('/:setId', async (req: Request, res: Response) => {
  try {
    const scenario = requireScenario(req);
    const setId = normalizeOverrideSetId(req.params.setId);
    const { mockDataPath, config } = getDashboardContext(req);

    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);
      try {
        await store.deleteOverrideSet(scenario, setId);
        const sets = await store.listOverrideSets(scenario);
        return res.json({ success: true, scenario, sets });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    deleteOverrideSetFromFs(mockDataPath, scenario, setId);
    const sets = listOverrideSetsFromFs(mockDataPath, scenario);
    return res.json({ success: true, scenario, sets });
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status ?? 500;
    const message = error instanceof Error ? error.message : String(error);
    if (status !== 500) {
      return res.status(status).json({ error: message });
    }
    console.error('[OverrideSetsRoute] Delete - Error:', error);
    return res.status(500).json({ error: 'Failed to delete override set', details: message });
  }
});

/** Ensure `default` exists as a named set for UI pickers. */
router.post('/ensure-default', async (req: Request, res: Response) => {
  try {
    const scenario = requireScenario(req);
    const { mockDataPath, config } = getDashboardContext(req);
    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);
      try {
        const existing = await store.getOverrideSet(scenario, DEFAULT_OVERRIDE_SET_ID);
        if (!existing.entries || Object.keys(existing.entries).length === 0) {
          await store.putOverrideSet(
            scenario,
            createEmptyOverrideSetDocument(DEFAULT_OVERRIDE_SET_ID)
          );
        }
        const sets = await store.listOverrideSets(scenario);
        return res.json({ success: true, scenario, sets });
      } finally {
        await store.close().catch(() => undefined);
      }
    }
    writeOverrideSetToFs(
      mockDataPath,
      scenario,
      readOverrideSetFromFs(mockDataPath, scenario, DEFAULT_OVERRIDE_SET_ID)
    );
    return res.json({
      success: true,
      scenario,
      sets: listOverrideSetsFromFs(mockDataPath, scenario),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[OverrideSetsRoute] Ensure default - Error:', error);
    return res.status(500).json({ error: 'Failed to ensure default override set', details: message });
  }
});

export const overrideSetsRouter = router;
