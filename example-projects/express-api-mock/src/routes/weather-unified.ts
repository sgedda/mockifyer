import express, { Request, Response } from 'express';
import { getCurrentWeatherUnified, getForecastUnified } from '../services/weather-unified';

const router = express.Router();

router.get('/current/:city', async (req: Request, res: Response) => {
  try {
    const { city } = req.params;
    const fullResponse = req.query.full === 'true' || req.query.full === '1';
    
    // Get clientType and scope from query parameters, with defaults
    const clientType = (req.query.clientType as string) || 'axios';
    const scope = (req.query.scope as string) || 'local';
    
    // Validate clientType and scope
    if (clientType !== 'axios' && clientType !== 'fetch') {
      return res.status(400).json({ 
        error: 'Invalid clientType. Must be "axios" or "fetch"' 
      });
    }
    
    if (scope !== 'local' && scope !== 'global') {
      return res.status(400).json({ 
        error: 'Invalid scope. Must be "local" or "global"' 
      });
    }
    
    const result = await getCurrentWeatherUnified(
      city, 
      fullResponse, 
      clientType as 'axios' | 'fetch',
      scope as 'local' | 'global'
    );

    // Prevent browser caching to ensure fresh headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Forward mockifyer headers if present
    if (result.headers) {
      console.log('[WeatherUnifiedRoute] Current - Headers to forward:', {
        totalHeaders: Object.keys(result.headers).length,
        headerKeys: Object.keys(result.headers),
        hasXMockifyer: 'x-mockifyer' in result.headers,
        xMockifyerValue: result.headers['x-mockifyer']
      });
      
      Object.entries(result.headers).forEach(([key, value]) => {
        if (key.toLowerCase().startsWith('x-mockifyer')) {
          console.log(`[WeatherUnifiedRoute] Current - Forwarding header: ${key} = ${value}`);
          res.setHeader(key, value);
        }
      });
    } else {
      console.warn('[WeatherUnifiedRoute] Current - No headers in result!');
    }
    
    // Add client configuration headers for frontend display
    res.setHeader('x-client-type', clientType);
    res.setHeader('x-scope', scope);
    
    res.json(result.data);
  } catch (error: any) {
    console.error('[WeatherUnifiedRoute] Current - Error:', {
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
    const days = parseInt(req.query.days as string) || 3;
    const fullResponse = req.query.full === 'true' || req.query.full === '1';
    
    // Get clientType and scope from query parameters, with defaults
    const clientType = (req.query.clientType as string) || 'axios';
    const scope = (req.query.scope as string) || 'local';
    
    // Validate clientType and scope
    if (clientType !== 'axios' && clientType !== 'fetch') {
      return res.status(400).json({ 
        error: 'Invalid clientType. Must be "axios" or "fetch"' 
      });
    }
    
    if (scope !== 'local' && scope !== 'global') {
      return res.status(400).json({ 
        error: 'Invalid scope. Must be "local" or "global"' 
      });
    }
    
    const result = await getForecastUnified(
      city, 
      days, 
      fullResponse,
      clientType as 'axios' | 'fetch',
      scope as 'local' | 'global'
    );

    // Prevent browser caching to ensure fresh headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Forward mockifyer headers if present
    if (result.headers) {
      console.log('[WeatherUnifiedRoute] Forecast - Headers to forward:', {
        totalHeaders: Object.keys(result.headers).length,
        headerKeys: Object.keys(result.headers),
        hasXMockifyer: 'x-mockifyer' in result.headers,
        xMockifyerValue: result.headers['x-mockifyer']
      });
      
      Object.entries(result.headers).forEach(([key, value]) => {
        if (key.toLowerCase().startsWith('x-mockifyer')) {
          console.log(`[WeatherUnifiedRoute] Forecast - Forwarding header: ${key} = ${value}`);
          res.setHeader(key, value);
        }
      });
    } else {
      console.warn('[WeatherUnifiedRoute] Forecast - No headers in result!');
    }
    
    // Add client configuration headers for frontend display
    res.setHeader('x-client-type', clientType);
    res.setHeader('x-scope', scope);
    
    res.json(result.data);
  } catch (error: any) {
    console.error('[WeatherUnifiedRoute] Forecast - Error:', {
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

export { router as weatherUnifiedRouter };

