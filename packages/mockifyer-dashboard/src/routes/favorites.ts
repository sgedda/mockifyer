import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getCurrentScenario, getScenarioFolderPath, type MockData } from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import { createDashboardMockStore } from '../utils/create-dashboard-mock-store';
import { isCentralizedDashboardProvider } from '../utils/dashboard-provider';
import { parseRedisHashFromFilename } from './mocks';
import {
  buildFavoriteFromMock,
  emptyFavoritesDocument,
  isFavoriteRequestId,
  parseFavoritesDocument,
  readFavoritesFile,
  removeFavorite,
  upsertFavorite,
  writeFavoritesFile,
  type FavoritesDocument,
} from '../utils/favorites-store';

const router = express.Router();

function resolveScenario(req: Request, mockDataPath: string): string {
  const fromQuery = typeof req.query.scenario === 'string' ? req.query.scenario.trim() : '';
  const fromBody =
    req.body && typeof (req.body as { scenario?: unknown }).scenario === 'string'
      ? String((req.body as { scenario: string }).scenario).trim()
      : '';
  return fromQuery || fromBody || getCurrentScenario(mockDataPath);
}

function resolveFilesystemMockPath(scenarioPath: string, relativeName: string): string | null {
  if (!relativeName.endsWith('.json')) return null;
  const resolved = path.resolve(scenarioPath, relativeName);
  const root = path.resolve(scenarioPath);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return null;
  return resolved;
}

async function loadFavoritesDocument(req: Request): Promise<FavoritesDocument> {
  const { mockDataPath, config } = getDashboardContext(req);
  if (isCentralizedDashboardProvider(config.provider)) {
    const store = createDashboardMockStore(config, mockDataPath);
    try {
      const raw = await store.getFavoritesJson();
      if (!raw) return emptyFavoritesDocument();
      return parseFavoritesDocument(JSON.parse(raw) as unknown);
    } catch {
      return emptyFavoritesDocument();
    } finally {
      await store.close().catch(() => undefined);
    }
  }
  return readFavoritesFile(mockDataPath);
}

async function saveFavoritesDocument(req: Request, document: FavoritesDocument): Promise<void> {
  const { mockDataPath, config } = getDashboardContext(req);
  const payload = parseFavoritesDocument(document);
  if (isCentralizedDashboardProvider(config.provider)) {
    const store = createDashboardMockStore(config, mockDataPath);
    try {
      await store.setFavoritesJson(JSON.stringify(payload));
    } finally {
      await store.close().catch(() => undefined);
    }
    writeFavoritesFile(mockDataPath, payload);
    return;
  }
  const wrote = writeFavoritesFile(mockDataPath, payload);
  if (!wrote) {
    throw Object.assign(new Error('Mock data path is not a writable directory'), { status: 500 });
  }
}

async function loadMockData(
  req: Request,
  scenario: string,
  filename: string
): Promise<MockData | null> {
  const { mockDataPath, config } = getDashboardContext(req);
  if (isCentralizedDashboardProvider(config.provider)) {
    const hash = parseRedisHashFromFilename(filename);
    if (!hash) return null;
    const store = createDashboardMockStore(config, mockDataPath);
    try {
      return await store.getByHash(hash, scenario);
    } finally {
      await store.close().catch(() => undefined);
    }
  }
  const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
  const filePath = resolveFilesystemMockPath(scenarioPath, filename);
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MockData;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const document = await loadFavoritesDocument(req);
    return res.json({ favorites: document.favorites });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[FavoritesRoute] GET - Error:', error);
    return res.status(500).json({ error: 'Failed to list favorites', details: message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const body = (req.body ?? {}) as { scenario?: unknown; filename?: unknown };
    const filename = typeof body.filename === 'string' ? body.filename.trim() : '';
    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }
    const scenario = resolveScenario(req, mockDataPath);
    const mockData = await loadMockData(req, scenario, filename);
    if (!mockData) {
      return res.status(404).json({ error: 'Mock not found' });
    }
    const favorite = buildFavoriteFromMock(mockData, filename);
    if (!favorite) {
      return res.status(400).json({ error: 'Could not derive a request identity for this mock' });
    }
    const next = upsertFavorite(await loadFavoritesDocument(req), favorite);
    await saveFavoritesDocument(req, next);
    return res.json({ favorite, favorites: next.favorites });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : String(error);
    if (status !== 500) {
      return res.status(status).json({ error: message });
    }
    console.error('[FavoritesRoute] POST - Error:', error);
    return res.status(500).json({ error: 'Failed to add favorite', details: message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim().toLowerCase() : '';
    if (!isFavoriteRequestId(id)) {
      return res.status(400).json({ error: 'Invalid favorite id' });
    }
    const next = removeFavorite(await loadFavoritesDocument(req), id);
    await saveFavoritesDocument(req, next);
    return res.json({ favorites: next.favorites });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : String(error);
    if (status !== 500) {
      return res.status(status).json({ error: message });
    }
    console.error('[FavoritesRoute] DELETE - Error:', error);
    return res.status(500).json({ error: 'Failed to remove favorite', details: message });
  }
});

export const favoritesRouter = router;
