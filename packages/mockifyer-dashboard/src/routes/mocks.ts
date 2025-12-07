import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { detectMockDataPath } from '../utils/path-detector';
import { getCurrentScenario, getScenarioFolderPath } from '@sgedda/mockifyer-core';

const router = express.Router();

// Get mock data directory path - use the same detection logic as CLI
function getMockDataPath(): string {
  // Use the shared path detection function
  return detectMockDataPath();
}

// List all mock files
router.get('/', (req: Request, res: Response) => {
  try {
    const mockDataPath = getMockDataPath();
    // Allow scenario to be specified via query parameter, otherwise use current scenario
    const requestedScenario = req.query.scenario as string | undefined;
    const scenario = requestedScenario || getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
    
    if (!fs.existsSync(mockDataPath)) {
      return res.json({ files: [], mockDataPath, scenario });
    }

    if (!fs.existsSync(scenarioPath)) {
      return res.json({ files: [], mockDataPath, scenario });
    }

    const files = fs.readdirSync(scenarioPath)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(scenarioPath, file);
        const stats = fs.statSync(filePath);
        
        // Try to extract endpoint URL and query params from the mock file
        let endpoint = null;
        let graphqlInfo = null;
        let sessionId = null;
        try {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const mockData = JSON.parse(fileContent);
          if (mockData.request && mockData.request.url) {
            endpoint = mockData.request.url;
          }
          // Extract sessionId if available
          if (mockData.sessionId) {
            sessionId = mockData.sessionId;
          } else if (mockData.data && mockData.data.sessionId) {
            sessionId = mockData.data.sessionId;
          }
            
            // Check if this is a GraphQL request
            if (mockData.request.data) {
              let bodyData = mockData.request.data;
              
              // If body is a string, try to parse it as JSON
              if (typeof mockData.request.data === 'string') {
                try {
                  bodyData = JSON.parse(mockData.request.data);
                } catch (e) {
                  // Not JSON, skip GraphQL detection
                }
              }
              
              // Check if it's a GraphQL request (has a 'query' field)
              if (typeof bodyData === 'object' && bodyData !== null && typeof bodyData.query === 'string') {
                graphqlInfo = {
                  query: bodyData.query,
                  variables: bodyData.variables || null
                };
              }
            }
            
            // Add query parameters if they exist (only for non-GraphQL requests)
            if (!graphqlInfo && mockData.request.queryParams && Object.keys(mockData.request.queryParams).length > 0) {
              const params = new URLSearchParams();
              Object.entries(mockData.request.queryParams).forEach(([key, value]) => {
                if (value != null) {
                  params.append(key, String(value));
                }
              });
              const queryString = params.toString();
              if (queryString) {
                endpoint += '?' + queryString;
              }
            }
          }
        } catch (error) {
          // If file is corrupted or doesn't have expected structure, just skip endpoint
          console.warn(`[MocksRoute] Could not extract endpoint from ${file}:`, error);
        }
        
        return {
          filename: file,
          filePath: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          endpoint: endpoint,
          graphqlInfo: graphqlInfo,
          sessionId: sessionId
        };
      })
      .sort((a, b) => b.modified.getTime() - a.modified.getTime()); // Sort by most recent first

    res.json({ files, mockDataPath, scenario });
  } catch (error: any) {
    console.error('[MocksRoute] List - Error:', error);
    res.status(500).json({ error: 'Failed to list mock files', details: error.message });
  }
});

// Get a specific mock file's data
router.get('/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const mockDataPath = getMockDataPath();
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioFolderPath(mockDataPath, currentScenario);
    const filePath = path.join(scenarioPath, filename);

    // Security: prevent directory traversal
    if (!filename.endsWith('.json') || !path.resolve(filePath).startsWith(path.resolve(scenarioPath))) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Mock file not found' });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const mockData = JSON.parse(fileContent);
    const stats = fs.statSync(filePath);

    res.json({
      filename,
      data: mockData,
      metadata: {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      }
    });
  } catch (error: any) {
    console.error('[MocksRoute] Get - Error:', error);
    res.status(500).json({ error: 'Failed to read mock file', details: error.message });
  }
});

// Update a mock file (only updates response.data)
router.put('/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const mockDataPath = getMockDataPath();
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioFolderPath(mockDataPath, currentScenario);
    const filePath = path.join(scenarioPath, filename);

    // Security: prevent directory traversal
    if (!filename.endsWith('.json') || !path.resolve(filePath).startsWith(path.resolve(scenarioPath))) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Mock file not found' });
    }

    // Validate that request body contains responseData
    if (!req.body || req.body.responseData === undefined) {
      return res.status(400).json({ error: 'Request body must contain responseData field' });
    }

    // Read the existing file to preserve all other data
    const existingContent = fs.readFileSync(filePath, 'utf-8');
    let existingData: any;
    try {
      existingData = JSON.parse(existingContent);
    } catch (e) {
      return res.status(400).json({ error: 'Existing file is not valid JSON' });
    }

    // Validate the responseData is valid JSON
    let parsedResponseData;
    try {
      // If responseData is a string, parse it first
      if (typeof req.body.responseData === 'string') {
        parsedResponseData = JSON.parse(req.body.responseData);
      } else {
        parsedResponseData = req.body.responseData;
      }
    } catch (parseError: any) {
      return res.status(400).json({ 
        error: 'Invalid JSON', 
        details: parseError.message,
        message: 'The provided responseData is not valid JSON. Please check your syntax.'
      });
    }

    // Ensure response structure exists
    if (!existingData.response) {
      existingData.response = { status: 200, data: {}, headers: {} };
    }

    // Update only response.data (the actual API response data)
    // This preserves request, timestamp, scenario, and response.status/headers
    existingData.response.data = parsedResponseData;

    // Write the updated JSON to file with pretty formatting
    const formattedJson = JSON.stringify(existingData, null, 2);
    fs.writeFileSync(filePath, formattedJson, 'utf-8');
    
    const stats = fs.statSync(filePath);
    
    console.log(`[MocksRoute] Updated mock file: ${filename}`);
    res.json({ 
      success: true, 
      message: `Mock file ${filename} updated successfully`,
      filename,
      metadata: {
        size: stats.size,
        modified: stats.mtime
      }
    });
  } catch (error: any) {
    console.error('[MocksRoute] Update - Error:', error);
    res.status(500).json({ error: 'Failed to update mock file', details: error.message });
  }
});

// Delete a mock file
router.delete('/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const mockDataPath = getMockDataPath();
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioFolderPath(mockDataPath, currentScenario);
    const filePath = path.join(scenarioPath, filename);

    // Security: prevent directory traversal
    if (!filename.endsWith('.json') || !path.resolve(filePath).startsWith(path.resolve(scenarioPath))) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Mock file not found' });
    }

    fs.unlinkSync(filePath);
    
    console.log(`[MocksRoute] Deleted mock file: ${filename}`);
    res.json({ 
      success: true, 
      message: `Mock file ${filename} deleted successfully`,
      filename 
    });
  } catch (error: any) {
    console.error('[MocksRoute] Delete - Error:', error);
    res.status(500).json({ error: 'Failed to delete mock file', details: error.message });
  }
});

// Duplicate a mock file
router.post('/:filename/duplicate', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const mockDataPath = getMockDataPath();
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioFolderPath(mockDataPath, currentScenario);
    const filePath = path.join(scenarioPath, filename);

    // Security: prevent directory traversal
    if (!filename.endsWith('.json') || !path.resolve(filePath).startsWith(path.resolve(scenarioPath))) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Mock file not found' });
    }

    // Read the original file
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const mockData = JSON.parse(fileContent);
    
    // Generate new filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const baseName = filename.replace(/\.json$/, '');
    const newFilename = `${timestamp}_${baseName}_copy.json`;
    const newFilePath = path.join(scenarioPath, newFilename);
    
    // Update timestamp in the data
    mockData.timestamp = new Date().toISOString();
    
    // Write the duplicate file
    fs.writeFileSync(newFilePath, JSON.stringify(mockData, null, 2), 'utf-8');
    
    res.json({ 
      success: true, 
      message: `Mock file duplicated successfully`,
      originalFilename: filename,
      newFilename: newFilename
    });
  } catch (error: any) {
    console.error('[MocksRoute] Duplicate - Error:', error);
    res.status(500).json({ error: 'Failed to duplicate mock file', details: error.message });
  }
});

export const mocksRouter = router;

