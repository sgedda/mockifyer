import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { detectMockDataPath } from '../utils/path-detector';
import { getCurrentScenario, getScenarioFolderPath } from '@sgedda/mockifyer-core';

const router = express.Router();

function getMockDataPath(): string {
  // Use the shared path detection function
  return detectMockDataPath();
}

router.get('/', (req: Request, res: Response) => {
  try {
    const mockDataPath = getMockDataPath();
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioFolderPath(mockDataPath, currentScenario);
    
    if (!fs.existsSync(mockDataPath)) {
      return res.json({
        totalFiles: 0,
        totalSize: 0,
        endpoints: [],
        domains: {},
        methods: {},
        statusCodes: {},
        recentActivity: [],
        scenario: currentScenario
      });
    }

    if (!fs.existsSync(scenarioPath)) {
      return res.json({
        totalFiles: 0,
        totalSize: 0,
        endpoints: [],
        domains: {},
        methods: {},
        statusCodes: {},
        recentActivity: [],
        scenario: currentScenario
      });
    }

    const files = fs.readdirSync(scenarioPath)
      .filter(file => file.endsWith('.json'));

    let totalSize = 0;
    const endpoints: Record<string, number> = {};
    const domains: Record<string, number> = {};
    const methods: Record<string, number> = {};
    const statusCodes: Record<string, number> = {};
    const recentActivity: Array<{ filename: string; modified: Date }> = [];

    files.forEach(file => {
      const filePath = path.join(scenarioPath, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
      
      recentActivity.push({
        filename: file,
        modified: stats.mtime
      });

      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const mockData = JSON.parse(fileContent);
        
        if (mockData.request) {
          // Count endpoints
          const endpoint = mockData.request.url || 'unknown';
          endpoints[endpoint] = (endpoints[endpoint] || 0) + 1;
          
          // Count methods
          const method = mockData.request.method || 'unknown';
          methods[method] = (methods[method] || 0) + 1;
          
          // Count domains
          try {
            const url = new URL(mockData.request.url);
            const domain = url.hostname;
            domains[domain] = (domains[domain] || 0) + 1;
          } catch (e) {
            // Invalid URL, skip
          }
        }
        
        if (mockData.response) {
          const status = String(mockData.response.status || 200);
          statusCodes[status] = (statusCodes[status] || 0) + 1;
        }
      } catch (error) {
        // Skip corrupted files
      }
    });

    // Sort recent activity by modified date
    recentActivity.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    
    // Get top endpoints
    const topEndpoints = Object.entries(endpoints)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));

    res.json({
      totalFiles: files.length,
      totalSize,
      endpoints: topEndpoints,
      domains,
      methods,
      statusCodes,
      recentActivity: recentActivity.slice(0, 10).map(item => ({
        filename: item.filename,
        modified: item.modified.toISOString()
      })),
      scenario: currentScenario
    });
  } catch (error: any) {
    console.error('[StatsRoute] Error:', error);
    res.status(500).json({ error: 'Failed to get statistics', details: error.message });
  }
});

export const statsRouter = router;

