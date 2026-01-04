import express, { Request, Response } from 'express';
import { getCurrentWeather } from '../services/weather-fetch';

const router = express.Router();

router.get('/current/:city', async (req: Request, res: Response) => {
  try {
    const { city } = req.params;
    const fullResponse = req.query.full === 'true' || req.query.full === '1';
    const result = await getCurrentWeather(city, fullResponse);

    // Prevent browser caching to ensure fresh headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    console.log('result', result);
    res.json(result.data);
  } catch (error: any) {
    console.error('[WeatherFetchRoute] Error:', error);
    const errorMessage = error?.message || 'Failed to fetch weather data';
    const statusCode = error?.response?.status || 500;
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

export { router as weatherFetchRouter };

