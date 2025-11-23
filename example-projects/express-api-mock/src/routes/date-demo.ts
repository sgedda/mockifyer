import express, { Request, Response } from 'express';
import { getCurrentDate } from '@sgedda/mockifyer';

const router = express.Router();

// Demo endpoint to show date manipulation
router.get('/', (req: Request, res: Response) => {
  try {
    const manipulatedDate = getCurrentDate();
    const systemDate = new Date();
    
    const response = {
      manipulated: {
        iso: manipulatedDate.toISOString(),
        local: manipulatedDate.toLocaleString(),
        utc: manipulatedDate.toUTCString(),
        timestamp: manipulatedDate.getTime(),
        year: manipulatedDate.getFullYear(),
        month: manipulatedDate.getMonth() + 1, // 1-based
        day: manipulatedDate.getDate(),
        hours: manipulatedDate.getHours(),
        minutes: manipulatedDate.getMinutes(),
        seconds: manipulatedDate.getSeconds()
      },
      system: {
        iso: systemDate.toISOString(),
        local: systemDate.toLocaleString(),
        utc: systemDate.toUTCString(),
        timestamp: systemDate.getTime()
      },
      difference: {
        milliseconds: manipulatedDate.getTime() - systemDate.getTime(),
        seconds: Math.round((manipulatedDate.getTime() - systemDate.getTime()) / 1000),
        minutes: Math.round((manipulatedDate.getTime() - systemDate.getTime()) / (1000 * 60)),
        hours: Math.round((manipulatedDate.getTime() - systemDate.getTime()) / (1000 * 60 * 60)),
        days: Math.round((manipulatedDate.getTime() - systemDate.getTime()) / (1000 * 60 * 60 * 24))
      },
      note: 'The manipulated date is what Mockifyer uses for all date operations. Configure it in the Date Configuration page.'
    };
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json(response);
  } catch (error: any) {
    console.error('[DateDemo] Error:', error);
    res.status(500).json({ error: 'Failed to get date information', details: error.message });
  }
});

export { router as dateDemoRouter };

