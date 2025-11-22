import express, { Request, Response } from 'express';
import { weatherService } from '../services/weather';

const router = express.Router();

router.get('/current/:city', async (req: Request, res: Response) => {
  try {
    const { city } = req.params;
    const result = await weatherService.getCurrentWeather(city);
    
    // Log headers received from service
    console.log('[WeatherRoute] Current - Headers from service:', {
      hasHeaders: !!result.headers,
      headerKeys: Object.keys(result.headers || {}),
      xMockifyer: result.headers['x-mockifyer'],
      allHeaders: result.headers
    });
    
    // Pass through mockifyer headers if present (case-insensitive check)
    const mockHeader = result.headers['x-mockifyer'] || result.headers['X-Mockifyer'] || result.headers['X-MOCKIFYER'];
    if (mockHeader === 'true') {
      console.log('[WeatherRoute] Current - Setting mock headers');
      res.setHeader('x-mockifyer', mockHeader);
      if (result.headers['x-mockifyer-timestamp'] || result.headers['X-Mockifyer-Timestamp']) {
        res.setHeader('x-mockifyer-timestamp', result.headers['x-mockifyer-timestamp'] || result.headers['X-Mockifyer-Timestamp']);
      }
      if (result.headers['x-mockifyer-filename'] || result.headers['X-Mockifyer-Filename']) {
        res.setHeader('x-mockifyer-filename', result.headers['x-mockifyer-filename'] || result.headers['X-Mockifyer-Filename']);
      }
      if (result.headers['x-mockifyer-filepath'] || result.headers['X-Mockifyer-Filepath']) {
        res.setHeader('x-mockifyer-filepath', result.headers['x-mockifyer-filepath'] || result.headers['X-Mockifyer-Filepath']);
      }
    } else {
      // Explicitly ensure mock headers are NOT set for real API calls
      console.log('[WeatherRoute] Current - Real API call, NOT setting mock headers. Mock header value:', mockHeader);
      // Don't call removeHeader if it doesn't exist - just don't set it
    }
    
    // Prevent browser caching to ensure fresh headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json(result.data);
  } catch (error: any) {
    console.error('[WeatherRoute] Current - Error:', {
      message: error?.message,
      stack: error?.stack,
      response: error?.response?.data,
      status: error?.response?.status
    });
    const errorMessage = error?.message || 'Failed to fetch weather data';
    const statusCode = error?.response?.status || 500;
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

router.get('/forecast/:city', async (req: Request, res: Response) => {
  try {
    const { city } = req.params;
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 3;
    const result = await weatherService.getForecast(city, days);
    
    // Log headers received from service
    console.log('[WeatherRoute] Forecast - Headers from service:', {
      hasHeaders: !!result.headers,
      headerKeys: Object.keys(result.headers || {}),
      xMockifyer: result.headers['x-mockifyer'],
      allHeaders: result.headers
    });
    
    // Pass through mockifyer headers if present (case-insensitive check)
    const mockHeader = result.headers['x-mockifyer'] || result.headers['X-Mockifyer'] || result.headers['X-MOCKIFYER'];
    if (mockHeader === 'true') {
      console.log('[WeatherRoute] Forecast - Setting mock headers');
      res.setHeader('x-mockifyer', mockHeader);
      if (result.headers['x-mockifyer-timestamp'] || result.headers['X-Mockifyer-Timestamp']) {
        res.setHeader('x-mockifyer-timestamp', result.headers['x-mockifyer-timestamp'] || result.headers['X-Mockifyer-Timestamp']);
      }
      if (result.headers['x-mockifyer-filename'] || result.headers['X-Mockifyer-Filename']) {
        res.setHeader('x-mockifyer-filename', result.headers['x-mockifyer-filename'] || result.headers['X-Mockifyer-Filename']);
      }
      if (result.headers['x-mockifyer-filepath'] || result.headers['X-Mockifyer-Filepath']) {
        res.setHeader('x-mockifyer-filepath', result.headers['x-mockifyer-filepath'] || result.headers['X-Mockifyer-Filepath']);
      }
    } else {
      // Explicitly ensure mock headers are NOT set for real API calls
      console.log('[WeatherRoute] Forecast - Real API call, NOT setting mock headers. Mock header value:', mockHeader);
      // Don't call removeHeader if it doesn't exist - just don't set it
    }
    
    // Prevent browser caching to ensure fresh headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json(result.data);
  } catch (error: any) {
    console.error('[WeatherRoute] Forecast - Error:', {
      message: error?.message,
      stack: error?.stack,
      response: error?.response?.data,
      status: error?.response?.status
    });
    const errorMessage = error?.message || 'Failed to fetch forecast data';
    const statusCode = error?.response?.status || 500;
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

export const weatherRouter = router; 