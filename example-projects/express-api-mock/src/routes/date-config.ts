import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getCurrentDate } from '@sgedda/mockifyer-core';

const router = express.Router();

// Path to store date configuration
const getConfigPath = () => {
  // Use the same directory as mock data, or fallback to persisted directory
  if (process.env.MOCKIFYER_PATH) {
    const mockPath = process.env.MOCKIFYER_PATH;
    // If MOCKIFYER_PATH is a file path, use its directory; if it's a directory, use it directly
    const configDir = fs.existsSync(mockPath) && fs.statSync(mockPath).isFile()
      ? path.dirname(mockPath)
      : mockPath;
    return path.join(configDir, 'date-config.json');
  }
  return path.join(process.cwd(), 'persisted', 'date-config.json');
};

// Get current date configuration
router.get('/', (req: Request, res: Response) => {
  try {
    const configPath = getConfigPath();
    let config: any = {
      fixedDate: null,
      offset: null,
      offsetDays: null,
      offsetHours: null,
      offsetMinutes: null,
      timezone: null,
      enabled: false
    };

    // Read from config file if it exists
    if (fs.existsSync(configPath)) {
      try {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        config = { ...config, ...fileConfig };
      } catch (error) {
        console.warn('[DateConfig] Could not read config file:', error);
      }
    }

    // Also check environment variables (they take precedence)
    if (process.env.MOCKIFYER_DATE) {
      config.fixedDate = process.env.MOCKIFYER_DATE;
      config.enabled = true;
    } else if (process.env.MOCKIFYER_DATE_OFFSET) {
      const offset = parseInt(process.env.MOCKIFYER_DATE_OFFSET, 10);
      config.offset = offset;
      // Convert milliseconds to days, hours, minutes for display
      const absOffset = Math.abs(offset);
      config.offsetDays = Math.floor(absOffset / (24 * 60 * 60 * 1000));
      config.offsetHours = Math.floor((absOffset % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      config.offsetMinutes = Math.floor((absOffset % (60 * 60 * 1000)) / (60 * 1000));
      config.offsetSign = offset < 0 ? '-' : '+';
      config.enabled = true;
    } else if (config.enabled && (config.offset !== null && config.offset !== undefined)) {
      // If config file has offset but env vars don't, set env vars from config file
      // This ensures getCurrentDate() works correctly after server restart
      process.env.MOCKIFYER_DATE_OFFSET = config.offset.toString();
      delete process.env.MOCKIFYER_DATE;
    } else if (config.enabled && (config.offsetDays !== undefined || config.offsetHours !== undefined || config.offsetMinutes !== undefined)) {
      // If we only have days/hours/minutes but not offset in ms, calculate it
      const days = parseInt(config.offsetDays || 0, 10);
      const hours = parseInt(config.offsetHours || 0, 10);
      const minutes = parseInt(config.offsetMinutes || 0, 10);
      const sign = config.offsetSign === '-' ? -1 : 1;
      const offsetMs = sign * (
        days * 24 * 60 * 60 * 1000 +
        hours * 60 * 60 * 1000 +
        minutes * 60 * 1000
      );
      config.offset = offsetMs;
      process.env.MOCKIFYER_DATE_OFFSET = offsetMs.toString();
      delete process.env.MOCKIFYER_DATE;
    } else if (config.fixedDate && config.enabled) {
      // If config file has fixedDate but env vars don't, set env vars from config file
      process.env.MOCKIFYER_DATE = config.fixedDate;
      delete process.env.MOCKIFYER_DATE_OFFSET;
    } else if (!config.enabled) {
      // If disabled, clear env vars
      delete process.env.MOCKIFYER_DATE;
      delete process.env.MOCKIFYER_DATE_OFFSET;
    }

    if (process.env.MOCKIFYER_TIMEZONE) {
      config.timezone = process.env.MOCKIFYER_TIMEZONE;
      config.enabled = true;
    } else if (config.timezone && config.enabled) {
      // If config file has timezone but env vars don't, set env vars from config file
      process.env.MOCKIFYER_TIMEZONE = config.timezone;
    } else if (!config.enabled) {
      delete process.env.MOCKIFYER_TIMEZONE;
    }

    // Get current effective date (now that env vars are set correctly)
    const currentDate = getCurrentDate();
    config.currentDate = currentDate.toISOString();
    config.currentDateFormatted = currentDate.toLocaleString();

    res.json(config);
  } catch (error: any) {
    console.error('[DateConfig] GET Error:', error);
    res.status(500).json({ error: 'Failed to get date configuration', details: error.message });
  }
});

// Update date configuration
router.put('/', (req: Request, res: Response) => {
  try {
    const {
      fixedDate,
      offsetDays,
      offsetHours,
      offsetMinutes,
      offsetSign,
      timezone,
      enabled
    } = req.body;

    const configPath = getConfigPath();
    const configDir = path.dirname(configPath);

    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    let config: any = {};

    if (!enabled) {
      // Disable date manipulation
      config = {
        enabled: false,
        fixedDate: null,
        offset: null,
        timezone: null
      };
    } else if (fixedDate) {
      // Use fixed date
      config = {
        enabled: true,
        fixedDate,
        offset: null,
        timezone: timezone || null
      };
    } else if (offsetDays !== undefined || offsetHours !== undefined || offsetMinutes !== undefined) {
      // Calculate offset in milliseconds
      const days = parseInt(offsetDays || 0, 10);
      const hours = parseInt(offsetHours || 0, 10);
      const minutes = parseInt(offsetMinutes || 0, 10);
      const sign = offsetSign === '-' ? -1 : 1;
      
      const offsetMs = sign * (
        days * 24 * 60 * 60 * 1000 +
        hours * 60 * 60 * 1000 +
        minutes * 60 * 1000
      );

      config = {
        enabled: true,
        fixedDate: null,
        offset: offsetMs,
        offsetDays: days,
        offsetHours: hours,
        offsetMinutes: minutes,
        offsetSign: sign === -1 ? '-' : '+',
        timezone: timezone || null
      };
    } else if (timezone) {
      // Use timezone only
      config = {
        enabled: true,
        fixedDate: null,
        offset: null,
        timezone
      };
    } else {
      return res.status(400).json({ error: 'Invalid configuration. Provide fixedDate, offset, or timezone.' });
    }

    // Save to config file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Update environment variables (these take precedence in getCurrentDate)
    if (config.fixedDate) {
      process.env.MOCKIFYER_DATE = config.fixedDate;
      delete process.env.MOCKIFYER_DATE_OFFSET;
    } else if (config.offset !== null) {
      process.env.MOCKIFYER_DATE_OFFSET = config.offset.toString();
      delete process.env.MOCKIFYER_DATE;
    } else {
      delete process.env.MOCKIFYER_DATE;
      delete process.env.MOCKIFYER_DATE_OFFSET;
    }

    if (config.timezone) {
      process.env.MOCKIFYER_TIMEZONE = config.timezone;
    } else {
      delete process.env.MOCKIFYER_TIMEZONE;
    }

    // Get updated current date
    const currentDate = getCurrentDate();
    config.currentDate = currentDate.toISOString();
    config.currentDateFormatted = currentDate.toLocaleString();

    console.log('[DateConfig] Updated date configuration:', config);
    res.json({ 
      success: true, 
      message: 'Date configuration updated successfully',
      config 
    });
  } catch (error: any) {
    console.error('[DateConfig] PUT Error:', error);
    res.status(500).json({ error: 'Failed to update date configuration', details: error.message });
  }
});

export { router as dateConfigRouter };

