import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Get mock data directory path
function getMockDataPath(): string {
  const mockPath = process.env.MOCKIFYER_PATH || path.join(process.cwd(), 'mock-data');
  return path.isAbsolute(mockPath) ? mockPath : path.join(process.cwd(), mockPath);
}

// List all mock files
router.get('/', (req: Request, res: Response) => {
  try {
    const mockDataPath = getMockDataPath();
    
    if (!fs.existsSync(mockDataPath)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(mockDataPath)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(mockDataPath, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => b.modified.getTime() - a.modified.getTime()); // Sort by most recent first

    res.json({ files });
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
    const filePath = path.join(mockDataPath, filename);

    // Security: prevent directory traversal
    if (!filename.endsWith('.json') || !path.resolve(filePath).startsWith(path.resolve(mockDataPath))) {
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

// Delete a mock file
router.delete('/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const mockDataPath = getMockDataPath();
    const filePath = path.join(mockDataPath, filename);

    // Security: prevent directory traversal
    if (!filename.endsWith('.json') || !path.resolve(filePath).startsWith(path.resolve(mockDataPath))) {
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

export const mocksRouter = router;

