import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { detectMockDataPath } from '../utils/path-detector';

const router = express.Router();

const DATE_CONFIG_FILENAME = 'date-config.json';

// Get mock data directory path
function getMockDataPath(): string {
  try {
    return detectMockDataPath();
  } catch (error: any) {
    console.error('[DateConfigRoute] Error detecting mock data path:', error);
    // Fallback to default
    return path.join(process.cwd(), 'mock-data');
  }
}

// Get date config file path
function getDateConfigPath(): string {
  try {
    const mockDataPath = getMockDataPath();
    return path.join(mockDataPath, DATE_CONFIG_FILENAME);
  } catch (error: any) {
    console.error('[DateConfigRoute] Error getting config path:', error);
    // Fallback to default
    return path.join(process.cwd(), 'mock-data', DATE_CONFIG_FILENAME);
  }
}

// Get current date config
router.get('/', (req: Request, res: Response) => {
  try {
    const mockDataPath = getMockDataPath();
    const configPath = getDateConfigPath();
    
    console.log('[DateConfigRoute] GET - Mock data path:', mockDataPath);
    console.log('[DateConfigRoute] GET - Config path:', configPath);
    
    if (!fs.existsSync(configPath)) {
      console.log('[DateConfigRoute] GET - Config file does not exist, returning default');
      return res.json({ 
        dateManipulation: null,
        currentDate: new Date().toISOString()
      });
    }

    const fileContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(fileContent);
    
    const dateManipulation = config.dateManipulation || null;
    
    // Calculate current date based on config
    let currentDate: Date;
    if (dateManipulation?.fixedDate) {
      currentDate = new Date(dateManipulation.fixedDate);
    } else if (dateManipulation?.offset !== undefined) {
      currentDate = new Date(Date.now() + dateManipulation.offset);
    } else {
      currentDate = new Date();
    }

    console.log('[DateConfigRoute] GET - Success, returning:', { dateManipulation, currentDate: currentDate.toISOString() });
    res.json({
      dateManipulation: dateManipulation,
      currentDate: currentDate.toISOString()
    });
  } catch (error: any) {
    console.error('[DateConfigRoute] GET - Error:', error);
    console.error('[DateConfigRoute] GET - Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to read date config', details: error.message });
  }
});

// Update date config
router.post('/', (req: Request, res: Response) => {
  try {
    const { fixedDate, offset, timezone } = req.body;
    const configPath = getDateConfigPath();
    const mockDataPath = getMockDataPath();

    // Ensure mock data directory exists
    if (!fs.existsSync(mockDataPath)) {
      fs.mkdirSync(mockDataPath, { recursive: true });
    }

    // Validate input
    if (fixedDate !== undefined && fixedDate !== null && fixedDate !== '') {
      // Validate date format
      const testDate = new Date(fixedDate);
      if (isNaN(testDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format. Use ISO 8601 format (e.g., 2024-12-25T00:00:00.000Z)' });
      }
    }

    if (offset !== undefined && offset !== null && typeof offset !== 'number') {
      return res.status(400).json({ error: 'Offset must be a number (milliseconds)' });
    }

    // Build config object
    const dateManipulation: any = {};
    
    if (fixedDate !== undefined && fixedDate !== null && fixedDate !== '') {
      dateManipulation.fixedDate = fixedDate;
      // Clear offset if fixedDate is set
      delete dateManipulation.offset;
    } else if (offset !== undefined && offset !== null) {
      dateManipulation.offset = offset;
      // Clear fixedDate if offset is set
      delete dateManipulation.fixedDate;
    } else {
      // If both are cleared, remove date manipulation
      dateManipulation.fixedDate = null;
      dateManipulation.offset = undefined;
    }

    if (timezone !== undefined && timezone !== null && timezone !== '') {
      dateManipulation.timezone = timezone;
    } else {
      delete dateManipulation.timezone;
    }

    // If both fixedDate and offset are cleared, delete the config file
    if (!dateManipulation.fixedDate && dateManipulation.offset === undefined && !dateManipulation.timezone) {
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
      return res.json({
        success: true,
        message: 'Date manipulation cleared',
        dateManipulation: null,
        currentDate: new Date().toISOString()
      });
    }

    // Save config to file
    const config = {
      dateManipulation,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Calculate current date based on config
    let currentDate: Date;
    if (dateManipulation.fixedDate) {
      currentDate = new Date(dateManipulation.fixedDate);
    } else if (dateManipulation.offset !== undefined) {
      currentDate = new Date(Date.now() + dateManipulation.offset);
    } else {
      currentDate = new Date();
    }

    console.log(`[DateConfigRoute] Updated date config:`, dateManipulation);
    res.json({
      success: true,
      message: 'Date manipulation updated successfully',
      dateManipulation,
      currentDate: currentDate.toISOString()
    });
  } catch (error: any) {
    console.error('[DateConfigRoute] Update - Error:', error);
    res.status(500).json({ error: 'Failed to update date config', details: error.message });
  }
});

export const dateConfigRouter = router;

