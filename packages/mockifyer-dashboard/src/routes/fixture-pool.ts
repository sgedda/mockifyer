import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import {
  ensurePoolLayout,
  extractAllArrayItemsFromResponse,
  extractEntityDataFromResponse,
  getEntityPath,
  getResponseFixturePath,
  getScenarioFolderPath,
  isValidPoolId,
  loadPoolEntity,
  loadPoolIndex,
  loadPoolResponseItem,
  savePoolEntity,
  savePoolIndex,
  savePoolResponseItem,
  validatePoolEntity,
  validatePoolResponseItem,
  type FixturePoolFsAdapter,
  type MockData,
  type PoolEntity,
  type PoolResponseItem,
} from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';

const router = Router();

const fsAdapter: FixturePoolFsAdapter = {
  joinPath: (...parts) => path.join(...parts),
  existsSync: (p) => fs.existsSync(p),
  readFileSync: (p, encoding) => fs.readFileSync(p, encoding),
  writeFileSync: (p, data, encoding) => fs.writeFileSync(p, data, encoding),
  mkdirSync: (p, options) => {
    fs.mkdirSync(p, options);
  },
  readdirSync: (p) => fs.readdirSync(p),
};

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Reject path-traversal / unsafe pool ids before joining under pool/entities|responses.
 */
function requireValidPoolIdParam(id: string | undefined, res: Response): id is string {
  if (!id || !isValidPoolId(id)) {
    res.status(400).json({ error: 'Invalid pool id (must match [a-zA-Z0-9_-]+)' });
    return false;
  }
  return true;
}

function readMockFile(mockDataPath: string, scenario: string, filename: string): MockData | null {
  const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
  const filePath = path.join(scenarioPath, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as MockData;
  } catch {
    return null;
  }
}

/** GET /api/fixture-pool/entities */
router.get('/entities', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    ensurePoolLayout(mockDataPath, fsAdapter);
    const index = loadPoolIndex(mockDataPath, fsAdapter);
    const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
    const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase() : undefined;

    let entities = index.entities.map((entry) => ({
      ...entry,
    }));

    if (entityType) entities = entities.filter((e) => e.entityType === entityType);
    if (tag) entities = entities.filter((e) => e.tags?.includes(tag));
    if (q) {
      entities = entities.filter(
        (e) =>
          e.id.toLowerCase().includes(q) ||
          e.label.toLowerCase().includes(q) ||
          e.entityType.toLowerCase().includes(q)
      );
    }

    res.json({ entities, updatedAt: index.updatedAt });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/** GET /api/fixture-pool/entities/:id */
router.get('/entities/:id', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const id = req.params.id;
    if (!requireValidPoolIdParam(id, res)) return;
    const entity = loadPoolEntity(mockDataPath, id, fsAdapter);
    if (!entity) return res.status(404).json({ error: `Entity not found: ${id}` });
    res.json({
      entity,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/** POST /api/fixture-pool/entities — manual create */
router.post('/entities', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    ensurePoolLayout(mockDataPath, fsAdapter);
    const body = req.body as Partial<PoolEntity>;
    const now = nowIso();
    const entity: PoolEntity = {
      id: body.id ?? '',
      entityType: body.entityType ?? '',
      label: body.label ?? body.id ?? '',
      tags: body.tags,
      data: body.data,
      source: body.source ?? { kind: 'manual' },
      createdAt: now,
      updatedAt: now,
    };
    const err = validatePoolEntity(entity);
    if (err) return res.status(400).json({ error: err });

    const index = loadPoolIndex(mockDataPath, fsAdapter);
    if (index.entities.some((e) => e.id === entity.id)) {
      return res.status(409).json({ error: `Entity already exists: ${entity.id}` });
    }

    savePoolEntity(mockDataPath, entity, fsAdapter);
    index.entities.push({
      id: entity.id,
      label: entity.label,
      entityType: entity.entityType,
      tags: entity.tags,
      storageRef: `pool/entities/${entity.id}.json`,
      createdAt: now,
      updatedAt: now,
    });
    index.updatedAt = now;
    savePoolIndex(mockDataPath, index, fsAdapter);
    res.status(201).json({ entity });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/** POST /api/fixture-pool/entities/extract */
router.post('/entities/extract', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    ensurePoolLayout(mockDataPath, fsAdapter);
    const {
      scenario,
      filename,
      jsonPath,
      entityType,
      id,
      extractAllArrayItems,
      label,
      tags,
    } = req.body as {
      scenario: string;
      filename: string;
      jsonPath: string;
      entityType: string;
      id?: string;
      extractAllArrayItems?: boolean;
      label?: string;
      tags?: string[];
    };

    if (!scenario || !filename || !jsonPath || !entityType) {
      return res.status(400).json({
        error: 'scenario, filename, jsonPath, and entityType are required',
      });
    }

    const mock = readMockFile(mockDataPath, scenario, filename);
    if (!mock) return res.status(404).json({ error: `Mock not found: ${filename}` });

    const index = loadPoolIndex(mockDataPath, fsAdapter);
    const created: PoolEntity[] = [];
    const now = nowIso();

    if (extractAllArrayItems) {
      const extracted = extractAllArrayItemsFromResponse(mock.response?.data, jsonPath);
      if ('error' in extracted) return res.status(400).json({ error: extracted.error });
      if (extracted.length === 0) {
        return res.status(400).json({ error: `Array at "${jsonPath}" is empty` });
      }

      const plannedIds: string[] = [];
      for (let i = 0; i < extracted.length; i++) {
        const entityId =
          id && extracted.length === 1
            ? id
            : `${id ?? entityType}-${i + 1}`.replace(/[^a-zA-Z0-9_-]/g, '-');
        if (!isValidPoolId(entityId)) {
          return res.status(400).json({
            error: `Generated entity id is invalid for index ${i}: "${entityId}"`,
          });
        }
        if (index.entities.some((e) => e.id === entityId) || plannedIds.includes(entityId)) {
          return res.status(409).json({
            error: `Entity already exists (or duplicate in extract batch): ${entityId}`,
          });
        }
        plannedIds.push(entityId);
      }

      extracted.forEach((item, i) => {
        const entityId = plannedIds[i]!;
        const entity: PoolEntity = {
          id: entityId,
          entityType,
          label: label ? `${label} [${i}]` : `${entityType} ${entityId}`,
          tags,
          data: item.data,
          source: {
            kind: 'extracted',
            scenario,
            filename,
            jsonPath: item.jsonPath,
          },
          createdAt: now,
          updatedAt: now,
        };
        savePoolEntity(mockDataPath, entity, fsAdapter);
        index.entities.push({
          id: entity.id,
          label: entity.label,
          entityType: entity.entityType,
          tags: entity.tags,
          storageRef: `pool/entities/${entity.id}.json`,
          createdAt: now,
          updatedAt: now,
        });
        created.push(entity);
      });
    } else {
      const extracted = extractEntityDataFromResponse(mock.response?.data, jsonPath);
      if ('error' in extracted) return res.status(400).json({ error: extracted.error });
      const entityId = id ?? `${entityType}-${Date.now().toString(36)}`;
      if (!isValidPoolId(entityId)) {
        return res.status(400).json({ error: 'Invalid entity id' });
      }
      if (index.entities.some((e) => e.id === entityId)) {
        return res.status(409).json({ error: `Entity already exists: ${entityId}` });
      }
      const entity: PoolEntity = {
        id: entityId,
        entityType,
        label: label ?? entityId,
        tags,
        data: extracted.data,
        source: {
          kind: 'extracted',
          scenario,
          filename,
          jsonPath: extracted.jsonPath,
        },
        createdAt: now,
        updatedAt: now,
      };
      savePoolEntity(mockDataPath, entity, fsAdapter);
      index.entities.push({
        id: entity.id,
        label: entity.label,
        entityType: entity.entityType,
        tags: entity.tags,
        storageRef: `pool/entities/${entity.id}.json`,
        createdAt: now,
        updatedAt: now,
      });
      created.push(entity);
    }

    index.updatedAt = now;
    savePoolIndex(mockDataPath, index, fsAdapter);
    res.status(201).json({ entities: created });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/** POST /api/fixture-pool/entities/:id/fork */
router.post('/entities/:id/fork', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const sourceId = req.params.id;
    if (!requireValidPoolIdParam(sourceId, res)) return;
    const source = loadPoolEntity(mockDataPath, sourceId, fsAdapter);
    if (!source) return res.status(404).json({ error: 'Entity not found' });

    const newId = (req.body as { id?: string }).id;
    if (!newId || !isValidPoolId(newId)) {
      return res.status(400).json({ error: 'Valid id is required for fork' });
    }
    const index = loadPoolIndex(mockDataPath, fsAdapter);
    if (index.entities.some((e) => e.id === newId)) {
      return res.status(409).json({ error: `Entity already exists: ${newId}` });
    }

    const now = nowIso();
    const forked: PoolEntity = {
      ...source,
      id: newId,
      label: (req.body as { label?: string }).label ?? `${source.label} (fork)`,
      source: { kind: 'forked', fromEntityId: source.id },
      createdAt: now,
      updatedAt: now,
    };
    savePoolEntity(mockDataPath, forked, fsAdapter);
    index.entities.push({
      id: forked.id,
      label: forked.label,
      entityType: forked.entityType,
      tags: forked.tags,
      storageRef: `pool/entities/${forked.id}.json`,
      createdAt: now,
      updatedAt: now,
    });
    index.updatedAt = now;
    savePoolIndex(mockDataPath, index, fsAdapter);
    res.status(201).json({ entity: forked });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/** PUT /api/fixture-pool/entities/:id */
router.put('/entities/:id', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const id = req.params.id;
    if (!requireValidPoolIdParam(id, res)) return;
    const existing = loadPoolEntity(mockDataPath, id, fsAdapter);
    if (!existing) return res.status(404).json({ error: 'Entity not found' });

    const body = req.body as Partial<PoolEntity>;
    const updated: PoolEntity = {
      ...existing,
      label: body.label ?? existing.label,
      entityType: body.entityType ?? existing.entityType,
      tags: body.tags ?? existing.tags,
      data: body.data !== undefined ? body.data : existing.data,
      updatedAt: nowIso(),
    };
    const err = validatePoolEntity(updated);
    if (err) return res.status(400).json({ error: err });

    savePoolEntity(mockDataPath, updated, fsAdapter);
    const index = loadPoolIndex(mockDataPath, fsAdapter);
    const entry = index.entities.find((e) => e.id === updated.id);
    if (entry) {
      entry.label = updated.label;
      entry.entityType = updated.entityType;
      entry.tags = updated.tags;
      entry.updatedAt = updated.updatedAt;
    }
    index.updatedAt = updated.updatedAt!;
    savePoolIndex(mockDataPath, index, fsAdapter);
    res.json({ entity: updated });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/** DELETE /api/fixture-pool/entities/:id */
router.delete('/entities/:id', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const id = req.params.id;
    if (!requireValidPoolIdParam(id, res)) return;

    const filePath = getEntityPath(mockDataPath, id, fsAdapter);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const index = loadPoolIndex(mockDataPath, fsAdapter);
    index.entities = index.entities.filter((e) => e.id !== id);
    index.updatedAt = nowIso();
    savePoolIndex(mockDataPath, index, fsAdapter);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/** GET /api/fixture-pool/responses */
router.get('/responses', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    ensurePoolLayout(mockDataPath, fsAdapter);
    const index = loadPoolIndex(mockDataPath, fsAdapter);
    res.json({ responses: index.responses, updatedAt: index.updatedAt });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/** GET /api/fixture-pool/responses/:id */
router.get('/responses/:id', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const id = req.params.id;
    if (!requireValidPoolIdParam(id, res)) return;
    const item = loadPoolResponseItem(mockDataPath, id, fsAdapter);
    if (!item) return res.status(404).json({ error: 'Response fixture not found' });
    res.json({ response: item });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/** POST /api/fixture-pool/responses/promote */
router.post('/responses/promote', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    ensurePoolLayout(mockDataPath, fsAdapter);
    const { scenario, filename, id, label, tags } = req.body as {
      scenario: string;
      filename: string;
      id?: string;
      label?: string;
      tags?: string[];
    };
    if (!scenario || !filename) {
      return res.status(400).json({ error: 'scenario and filename are required' });
    }
    const mock = readMockFile(mockDataPath, scenario, filename);
    if (!mock) return res.status(404).json({ error: `Mock not found: ${filename}` });

    const responseItemId =
      id ??
      filename
        .replace(/\.json$/i, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .slice(0, 80);
    if (!isValidPoolId(responseItemId)) {
      return res.status(400).json({ error: 'Invalid response id' });
    }

    const index = loadPoolIndex(mockDataPath, fsAdapter);
    if (index.responses.some((r) => r.id === responseItemId)) {
      return res.status(409).json({ error: `Response fixture already exists: ${responseItemId}` });
    }

    const now = nowIso();
    const item: PoolResponseItem = {
      responseItemId,
      label: label ?? responseItemId,
      tags,
      request: mock.request,
      response: mock.response,
      timestamp: mock.timestamp,
      responseFieldOverrides: mock.responseFieldOverrides,
      responseDateOverrides: mock.responseDateOverrides,
      sourceRecording: { scenario, filename },
      createdAt: now,
      updatedAt: now,
    };
    const err = validatePoolResponseItem(item);
    if (err) return res.status(400).json({ error: err });

    savePoolResponseItem(mockDataPath, item, fsAdapter);
    index.responses.push({
      id: responseItemId,
      label: item.label ?? responseItemId,
      tags,
      storageRef: `pool/responses/${responseItemId}.json`,
      createdAt: now,
      updatedAt: now,
    });
    index.updatedAt = now;
    savePoolIndex(mockDataPath, index, fsAdapter);
    res.status(201).json({ response: item });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/** DELETE /api/fixture-pool/responses/:id */
router.delete('/responses/:id', (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const id = req.params.id;
    if (!requireValidPoolIdParam(id, res)) return;
    const filePath = getResponseFixturePath(mockDataPath, id, fsAdapter);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    const index = loadPoolIndex(mockDataPath, fsAdapter);
    index.responses = index.responses.filter((r) => r.id !== id);
    index.updatedAt = nowIso();
    savePoolIndex(mockDataPath, index, fsAdapter);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export const fixturePoolRouter = router;
