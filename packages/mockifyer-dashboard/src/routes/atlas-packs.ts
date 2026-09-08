import express, { Request, Response } from 'express';
import {
  deleteAtlasPackFromDisk,
  hydrateAtlasPackRuntimeFromDisk,
  listAtlasPacksFromDisk,
  normalizeAtlasPack,
  readAtlasPackConfig,
  readAtlasPackFromDisk,
  registerAtlasPacks,
  resetAtlasPackRuntime,
  setActiveAtlasPack,
  upsertAtlasPack,
  validateAtlasPack,
  writeAtlasPackConfig,
  writeAtlasPackToDisk,
  type AtlasPack,
} from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';

const router = express.Router();

function hydrate(mockDataPath: string): { packs: AtlasPack[]; currentPack: string | null } {
  return hydrateAtlasPackRuntimeFromDisk(mockDataPath, {
    reset: resetAtlasPackRuntime,
    registerAtlasPacks,
    setActiveAtlasPack,
  });
}

/** List packs + active pointer. */
router.get('/', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const { packs, currentPack } = hydrate(mockDataPath);
    return res.json({
      currentPack,
      count: packs.length,
      packs: packs.map((p) => ({
        id: p.id,
        label: p.label,
        updatedAt: p.updatedAt,
        overlayCount: p.overlays.length,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Failed to list atlas packs', details: message });
  }
});

/** Active pack config only. */
router.get('/config', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    return res.json(readAtlasPackConfig(mockDataPath));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Failed to read atlas pack config', details: message });
  }
});

/** Set active pack (`pack: null` clears). */
router.post('/set', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const packRaw = req.body?.pack;
    const packId =
      packRaw === null || packRaw === undefined || packRaw === ''
        ? null
        : String(packRaw).trim();

    if (packId) {
      const existing = readAtlasPackFromDisk(mockDataPath, packId);
      if (!existing) {
        return res.status(404).json({ error: `Atlas pack not found: ${packId}` });
      }
    }

    const config = writeAtlasPackConfig(mockDataPath, { currentPack: packId });
    hydrate(mockDataPath);
    return res.json({ ok: true, ...config });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Failed to set atlas pack', details: message });
  }
});

/** Get one pack (full document including overlays + pins). */
router.get('/:packId', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const packId = String(req.params.packId || '').trim();
    const pack = readAtlasPackFromDisk(mockDataPath, packId);
    if (!pack) return res.status(404).json({ error: 'Atlas pack not found' });
    return res.json({ pack });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Failed to get atlas pack', details: message });
  }
});

/** Create or replace a pack. */
router.put('/:packId', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const packId = String(req.params.packId || '').trim();
    const body = (req.body?.pack ?? req.body) as unknown;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body must be an atlas pack object' });
    }

    const candidate = {
      ...(body as AtlasPack),
      id: packId,
    };
    const validationError = validateAtlasPack(candidate);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const saved = writeAtlasPackToDisk(mockDataPath, normalizeAtlasPack(candidate));
    upsertAtlasPack(saved);
    const config = readAtlasPackConfig(mockDataPath);
    if (config.currentPack === saved.id) {
      setActiveAtlasPack(saved.id);
    }
    return res.status(200).json({ ok: true, pack: saved });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Failed to save atlas pack', details: message });
  }
});

/** Delete a pack. Clears active if it was selected. */
router.delete('/:packId', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const packId = String(req.params.packId || '').trim();
    const removed = deleteAtlasPackFromDisk(mockDataPath, packId);
    if (!removed) return res.status(404).json({ error: 'Atlas pack not found' });

    const config = readAtlasPackConfig(mockDataPath);
    if (config.currentPack === packId) {
      writeAtlasPackConfig(mockDataPath, { currentPack: null });
    }
    hydrate(mockDataPath);
    return res.json({ ok: true, removed: packId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Failed to delete atlas pack', details: message });
  }
});

/** Ensure disk packs are loaded into the dashboard process (call from createServer). */
export function bootstrapAtlasPacks(mockDataPath: string): void {
  hydrateAtlasPackRuntimeFromDisk(mockDataPath, {
    reset: resetAtlasPackRuntime,
    registerAtlasPacks,
    setActiveAtlasPack,
  });
}

export { router as atlasPacksRouter };

/** @internal test helper */
export function listPackIdsForTests(mockDataPath: string): string[] {
  return listAtlasPacksFromDisk(mockDataPath).map((p) => p.id);
}
