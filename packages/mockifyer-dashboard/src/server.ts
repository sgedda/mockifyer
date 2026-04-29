import express from 'express';
import path from 'path';
import { mocksRouter } from './routes/mocks';
import { statsRouter } from './routes/stats';
import { healthRouter } from './routes/health';
import { dateConfigRouter } from './routes/date-config';
import { scenarioConfigRouter } from './routes/scenario-config';
import { proxyRouter } from './routes/proxy';

export interface DashboardServerConfig {
  provider: 'filesystem' | 'sqlite' | 'redis';
  redisUrl?: string;
  keyPrefix?: string;
}

export function createServer(
  publicDir: string,
  mockDataPath: string,
  _config: DashboardServerConfig
): express.Application {
  const app = express();

  // Make config accessible to route handlers
  app.locals.mockDataPath = mockDataPath;
  app.locals.dashboardConfig = _config;

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  /** Avoid stale dashboard data: browsers may cache GET /api/* otherwise. */
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
  
  // CORS for local development
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // API routes - must be registered BEFORE static file serving
  app.use('/api/mocks', mocksRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/health', healthRouter);
  app.use('/api/date-config', dateConfigRouter);
  app.use('/api/scenario-config', scenarioConfigRouter);
  app.use('/api/proxy', proxyRouter);
  
  // Log route registration (for debugging)
  console.log(
    '[Server] Registered API routes: /api/mocks, /api/stats, /api/health, /api/date-config, /api/scenario-config, /api/proxy'
  );

  // Serve static files from public directory (React build output)
  // Only serve static files for GET requests to non-API paths
  app.use('/assets', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      express.static(path.join(publicDir, 'assets'))(req, res, next);
    } else {
      next();
    }
  });
  
  app.use((req, res, next) => {
    // Only serve static files for GET/HEAD requests that aren't API routes
    if ((req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api/')) {
      express.static(publicDir)(req, res, next);
    } else {
      next();
    }
  });

  // Fallback to index.html for SPA routing (GET requests only)
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes or asset requests
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found', path: req.path });
    }
    if (req.path.startsWith('/assets/')) {
      return res.status(404).send('Asset not found');
    }
    // Serve React app's index.html for all other GET routes
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  // Handle unmatched API routes (all HTTP methods) - must come AFTER SPA fallback
  // This catches any API routes that weren't matched by the routers above
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ 
        error: 'API endpoint not found', 
        path: req.path, 
        method: req.method 
      });
    }
    // For non-API routes that weren't handled, return 404
    res.status(404).send('Not found');
  });

  return app;
}

