import express, { Request, Response } from 'express';
import { getFixturesUnified, getStandingsUnified, getTeamInfoUnified } from '../services/football-unified';

const router = express.Router();

router.get('/fixtures', async (req: Request, res: Response) => {
  try {
    const season = req.query.season ? parseInt(req.query.season as string, 10) : undefined;
    const teamId = req.query.team ? parseInt(req.query.team as string, 10) : undefined;
    const date = req.query.date as string | undefined;
    
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
    
    const result = await getFixturesUnified(
      season,
      teamId,
      date,
      clientType as 'axios' | 'fetch',
      scope as 'local' | 'global'
    );

    // Prevent browser caching to ensure fresh headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Forward mockifyer headers if present
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        if (key.toLowerCase().startsWith('x-mockifyer')) {
          res.setHeader(key, value);
        }
      });
    }
    
    // Add client configuration headers for frontend display
    res.setHeader('x-client-type', clientType);
    res.setHeader('x-scope', scope);
    
    // Check if this is a limit response
    const isLimitReached = result.headers?.['x-mockifyer-limit-reached'] === 'true' || 
                          (result.data as any)?.limitReached === true ||
                          (result.data as any)?.error?.includes('Maximum') ||
                          (result.data as any)?.message?.includes('Maximum');
    
    if (isLimitReached) {
      // Return 429 status with limit error JSON
      res.status(429).json(result.data);
    } else {
      res.json(result.data);
    }
  } catch (error: any) {
    console.error('[FootballUnifiedRoute] Fixtures - Error:', error);
    const errorMessage = error?.message || 'Failed to fetch fixtures';
    const statusCode = error?.response?.status || 500;
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

router.get('/standings/:leagueId', async (req: Request, res: Response) => {
  try {
    const leagueId = parseInt(req.params.leagueId, 10);
    const season = req.query.season ? parseInt(req.query.season as string, 10) : new Date().getFullYear();
    
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
    
    const result = await getStandingsUnified(
      leagueId,
      season,
      clientType as 'axios' | 'fetch',
      scope as 'local' | 'global'
    );

    // Prevent browser caching to ensure fresh headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Forward mockifyer headers if present
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        if (key.toLowerCase().startsWith('x-mockifyer')) {
          res.setHeader(key, value);
        }
      });
    }
    
    // Add client configuration headers for frontend display
    res.setHeader('x-client-type', clientType);
    res.setHeader('x-scope', scope);
    
    // Check if this is a limit response
    const isLimitReached = result.headers?.['x-mockifyer-limit-reached'] === 'true' || 
                          (result.data as any)?.limitReached === true ||
                          (result.data as any)?.error?.includes('Maximum') ||
                          (result.data as any)?.message?.includes('Maximum');
    
    if (isLimitReached) {
      // Return 429 status with limit error JSON
      res.status(429).json(result.data);
    } else {
      res.json(result.data);
    }
  } catch (error: any) {
    console.error('[FootballUnifiedRoute] Standings - Error:', error);
    const errorMessage = error?.message || 'Failed to fetch standings';
    const statusCode = error?.response?.status || 500;
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

router.get('/team/:teamId', async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    
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
    
    const result = await getTeamInfoUnified(
      teamId,
      clientType as 'axios' | 'fetch',
      scope as 'local' | 'global'
    );

    // Prevent browser caching to ensure fresh headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Forward mockifyer headers if present
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        if (key.toLowerCase().startsWith('x-mockifyer')) {
          res.setHeader(key, value);
        }
      });
    }
    
    // Add client configuration headers for frontend display
    res.setHeader('x-client-type', clientType);
    res.setHeader('x-scope', scope);
    
    // Check if this is a limit response
    const isLimitReached = result.headers?.['x-mockifyer-limit-reached'] === 'true' || 
                          (result.data as any)?.limitReached === true ||
                          (result.data as any)?.error?.includes('Maximum') ||
                          (result.data as any)?.message?.includes('Maximum');
    
    if (isLimitReached) {
      // Return 429 status with limit error JSON
      res.status(429).json(result.data);
    } else {
      res.json(result.data);
    }
  } catch (error: any) {
    console.error('[FootballUnifiedRoute] Team - Error:', error);
    const errorMessage = error?.message || 'Failed to fetch team information';
    // Check for status in error.status or error.response.status, default to 404 for "not found" errors
    const statusCode = error?.status || error?.response?.status || (errorMessage.includes('not found') ? 404 : 500);
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

export { router as footballUnifiedRouter };

