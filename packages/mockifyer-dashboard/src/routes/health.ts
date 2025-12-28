import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { detectMockDataPath } from '../utils/path-detector';

const router = express.Router();

function getMockDataPath(): string {
  // Use the shared path detection function
  return detectMockDataPath();
}

router.get('/', (req: Request, res: Response) => {
  const mockDataPath = getMockDataPath();
  const exists = fs.existsSync(mockDataPath);
  let fileCount = 0;
  
  if (exists) {
    try {
      const files = fs.readdirSync(mockDataPath)
        .filter(file => file.endsWith('.json') && file !== 'date-config.json');
      fileCount = files.length;
    } catch (error) {
      // Ignore errors
    }
  }
  
  res.json({
    status: 'ok',
    mockDataPath,
    exists,
    fileCount,
    provider: 'filesystem', // Currently only filesystem is supported
    timestamp: new Date().toISOString()
  });
});

export const healthRouter = router;

