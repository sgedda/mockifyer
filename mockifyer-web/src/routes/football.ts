import express, { Request, Response } from 'express';
import { footballService } from '../services/football';

const router = express.Router();

router.get('/fixtures', async (req: Request, res: Response) => {
  try {
    const season = req.query.season ? parseInt(req.query.season as string, 10) : undefined;
    const teamId = req.query.team ? parseInt(req.query.team as string, 10) : undefined;
    const date = req.query.date as string | undefined;
    const result = await footballService.getFixtures(season, teamId, date);
    
    // Pass through mockifyer headers if present (case-insensitive check)
    const mockHeader = result.headers['x-mockifyer'] || result.headers['X-Mockifyer'] || result.headers['X-MOCKIFYER'];
    if (mockHeader === 'true') {
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
    }
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json(result.data);
  } catch (error: any) {
    console.error('[FootballRoute] Fixtures - Error:', error);
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

    console.log("HEELLLLOO")
    
    const result = await footballService.getStandings(leagueId, season);
    
    // Pass through mockifyer headers if present
    const mockHeader = result.headers['x-mockifyer'] || result.headers['X-Mockifyer'] || result.headers['X-MOCKIFYER'];
    if (mockHeader === 'true') {
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
    }
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json(result.data);
  } catch (error: any) {
    console.error('[FootballRoute] Standings - Error:', error);
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
    
    const result = await footballService.getTeamInfo(teamId);
    
    // Pass through mockifyer headers if present
    const mockHeader = result.headers['x-mockifyer'] || result.headers['X-Mockifyer'] || result.headers['X-MOCKIFYER'];
    if (mockHeader === 'true') {
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
    }
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json(result.data);
  } catch (error: any) {
    console.error('[FootballRoute] Team - Error:', error);
    const errorMessage = error?.message || 'Failed to fetch team information';
    const statusCode = error?.response?.status || 500;
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

export const footballRouter = router;

