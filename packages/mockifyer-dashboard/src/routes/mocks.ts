import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { detectMockDataPath } from '../utils/path-detector';
import { getAllJsonFiles } from '../utils/json-files';
import { getCurrentScenario, getScenarioFolderPath } from '@sgedda/mockifyer-core';

const router = express.Router();

function getMockDataPath(): string {
  return detectMockDataPath();
}

// List all mock files (recursive)
router.get('/', (req: Request, res: Response) => {
  try {
    const mockDataPath = getMockDataPath();
    const requestedScenario = req.query.scenario as string | undefined;
    const scenario = requestedScenario || getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);

    if (!fs.existsSync(mockDataPath) || !fs.existsSync(scenarioPath)) {
      return res.json({ files: [], mockDataPath, scenario });
    }

    const files = getAllJsonFiles(scenarioPath)
      .map(filePath => {
        const relativeName = path.relative(scenarioPath, filePath);
        const stats = fs.statSync(filePath);

        let endpoint = null;
        let graphqlInfo = null;
        let sessionId = null;
        try {
          const mockData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          if (mockData.request?.url) {
            endpoint = mockData.request.url;
          }
          if (mockData.sessionId) sessionId = mockData.sessionId;
          else if (mockData.data?.sessionId) sessionId = mockData.data.sessionId;

          if (mockData.request?.data) {
            let bodyData = mockData.request.data;
            if (typeof bodyData === 'string') {
              try { bodyData = JSON.parse(bodyData); } catch { /* not JSON */ }
            }
            if (typeof bodyData === 'object' && bodyData !== null && typeof bodyData.query === 'string') {
              graphqlInfo = { query: bodyData.query, variables: bodyData.variables || null };
            }
          }

          if (!graphqlInfo && mockData.request?.queryParams && Object.keys(mockData.request.queryParams).length > 0) {
            const params = new URLSearchParams();
            Object.entries(mockData.request.queryParams).forEach(([key, value]) => {
              if (value != null) params.append(key, String(value));
            });
            const qs = params.toString();
            if (qs) endpoint += '?' + qs;
          }
        } catch (error) {
          console.warn(`[MocksRoute] Could not extract endpoint from ${relativeName}:`, error);
        }

        return {
          filename: relativeName,
          filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          endpoint,
          graphqlInfo,
          sessionId,
        };
      })
      .sort((a, b) => b.modified.getTime() - a.modified.getTime());

    res.json({ files, mockDataPath, scenario });
  } catch (error: any) {
    console.error('[MocksRoute] List - Error:', error);
    res.status(500).json({ error: 'Failed to list mock files', details: error.message });
  }
});

/** Resolve and validate a relative filename (may contain slashes) within the scenario path. */
function resolveFilePath(scenarioPath: string, relativeName: string): string | null {
  if (!relativeName.endsWith('.json')) return null;
  const resolved = path.resolve(scenarioPath, relativeName);
  if (!resolved.startsWith(path.resolve(scenarioPath) + path.sep) &&
      resolved !== path.resolve(scenarioPath)) return null;
  return resolved;
}

// Get a specific mock file — filename may contain slashes (e.g. host/graphql/file.json)
router.get('/*', (req: Request, res: Response) => {
  try {
    const relativeName = req.params[0];
    const mockDataPath = getMockDataPath();
    const scenarioPath = getScenarioFolderPath(mockDataPath, getCurrentScenario(mockDataPath));
    const filePath = resolveFilePath(scenarioPath, relativeName);

    if (!filePath) return res.status(400).json({ error: 'Invalid filename' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Mock file not found' });

    const mockData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const stats = fs.statSync(filePath);
    res.json({ filename: relativeName, data: mockData, metadata: { size: stats.size, created: stats.birthtime, modified: stats.mtime } });
  } catch (error: any) {
    console.error('[MocksRoute] Get - Error:', error);
    res.status(500).json({ error: 'Failed to read mock file', details: error.message });
  }
});

// Update a mock file
router.put('/*', (req: Request, res: Response) => {
  try {
    const relativeName = req.params[0];
    const mockDataPath = getMockDataPath();
    const scenarioPath = getScenarioFolderPath(mockDataPath, getCurrentScenario(mockDataPath));
    const filePath = resolveFilePath(scenarioPath, relativeName);

    if (!filePath) return res.status(400).json({ error: 'Invalid filename' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Mock file not found' });
    if (!req.body || req.body.responseData === undefined) {
      return res.status(400).json({ error: 'Request body must contain responseData field' });
    }

    let existingData: any;
    try { existingData = JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
    catch { return res.status(400).json({ error: 'Existing file is not valid JSON' }); }

    let parsedResponseData;
    try {
      parsedResponseData = typeof req.body.responseData === 'string'
        ? JSON.parse(req.body.responseData) : req.body.responseData;
    } catch (e: any) {
      return res.status(400).json({ error: 'Invalid JSON', details: e.message });
    }

    if (!existingData.response) existingData.response = { status: 200, data: {}, headers: {} };
    existingData.response.data = parsedResponseData;

    if (Object.prototype.hasOwnProperty.call(req.body, 'responseDateOverrides')) {
      const raw = req.body.responseDateOverrides;
      if (raw === null) {
        delete existingData.responseDateOverrides;
      } else if (Array.isArray(raw)) {
        for (const item of raw) {
          if (!item || typeof item !== 'object' || typeof item.path !== 'string' || !item.path.trim()) {
            return res.status(400).json({
              error: 'Each responseDateOverrides entry must be an object with a non-empty path string',
            });
          }
        }
        if (raw.length === 0) {
          delete existingData.responseDateOverrides;
        } else {
          existingData.responseDateOverrides = raw;
        }
      } else {
        return res.status(400).json({ error: 'responseDateOverrides must be an array or null' });
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8');

    const stats = fs.statSync(filePath);
    console.log(`[MocksRoute] Updated mock file: ${relativeName}`);
    res.json({ success: true, message: `Mock file updated successfully`, filename: relativeName, metadata: { size: stats.size, modified: stats.mtime } });
  } catch (error: any) {
    console.error('[MocksRoute] Update - Error:', error);
    res.status(500).json({ error: 'Failed to update mock file', details: error.message });
  }
});

// Delete a mock file
router.delete('/*', (req: Request, res: Response) => {
  try {
    const relativeName = req.params[0];
    const mockDataPath = getMockDataPath();
    const scenarioPath = getScenarioFolderPath(mockDataPath, getCurrentScenario(mockDataPath));
    const filePath = resolveFilePath(scenarioPath, relativeName);

    if (!filePath) return res.status(400).json({ error: 'Invalid filename' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Mock file not found' });

    fs.unlinkSync(filePath);
    console.log(`[MocksRoute] Deleted mock file: ${relativeName}`);
    res.json({ success: true, message: `Mock file deleted successfully`, filename: relativeName });
  } catch (error: any) {
    console.error('[MocksRoute] Delete - Error:', error);
    res.status(500).json({ error: 'Failed to delete mock file', details: error.message });
  }
});

// Duplicate a mock file
router.post('/*/duplicate', (req: Request, res: Response) => {
  try {
    // params[0] captures everything between the leading / and /duplicate
    const relativeName = req.params[0];
    const mockDataPath = getMockDataPath();
    const scenarioPath = getScenarioFolderPath(mockDataPath, getCurrentScenario(mockDataPath));
    const filePath = resolveFilePath(scenarioPath, relativeName);

    if (!filePath) return res.status(400).json({ error: 'Invalid filename' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Mock file not found' });

    const mockData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const dir = path.dirname(filePath);
    const base = path.basename(relativeName, '.json');
    const newFilename = `${timestamp}_${base}_copy.json`;
    const newFilePath = path.join(dir, newFilename);
    mockData.timestamp = new Date().toISOString();
    fs.writeFileSync(newFilePath, JSON.stringify(mockData, null, 2), 'utf-8');

    const newRelative = path.relative(scenarioPath, newFilePath);
    res.json({ success: true, message: 'Mock file duplicated successfully', originalFilename: relativeName, newFilename: newRelative });
  } catch (error: any) {
    console.error('[MocksRoute] Duplicate - Error:', error);
    res.status(500).json({ error: 'Failed to duplicate mock file', details: error.message });
  }
});

export const mocksRouter = router;
