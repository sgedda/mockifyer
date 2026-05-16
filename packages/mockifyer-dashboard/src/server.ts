import express from 'express';
import path from 'path';
import { initializeDateManipulation } from '@sgedda/mockifyer-core';
import { mocksRouter } from './routes/mocks';
import { statsRouter } from './routes/stats';
import { healthRouter } from './routes/health';
import { dateConfigRouter } from './routes/date-config';
import { scenarioConfigRouter } from './routes/scenario-config';
import { proxyRouter } from './routes/proxy';
import { clientLanesRouter } from './routes/client-lanes';
import { proxyConfigRouter } from './routes/proxy-config';
import type {
  DashboardContextConfig,
  RedisDiskMirrorConfigInput,
  RedisDiskMirrorResolved,
} from './utils/dashboard-context';

export type { DashboardContextConfig, RedisDiskMirrorConfigInput, RedisDiskMirrorResolved };

/**
 * Same limit string the dashboard uses for `express.json` / `urlencoded` (env
 * `MOCKIFYER_DASHBOARD_JSON_BODY_LIMIT`, default `50mb`).
 *
 * When you mount {@link createServer} under another Express app, if that app
 * already registered `express.json()` **before** this mount, that parser runs
 * first and often still uses Express’s default (~100kb) — large scenario imports
 * then return **413** before the dashboard’s body parser runs. Fix by either:
 * mounting the dashboard **before** the host’s `express.json()`, or passing
 * `{ limit: getDashboardJsonBodyLimit() }` on the host’s `express.json()`.
 */
export function getDashboardJsonBodyLimit(): string {
  return process.env.MOCKIFYER_DASHBOARD_JSON_BODY_LIMIT?.trim() || '50mb';
}

/**
 * Creates the dashboard Express app (static UI + `/api/*`). Uses a large JSON
 * body limit for scenario import; see {@link getDashboardJsonBodyLimit} when
 * embedding under another app that already uses `express.json()`.
 */
export function createServer(
  publicDir: string,
  mockDataPath: string,
  config: DashboardContextConfig = { provider: 'filesystem' }
): express.Application {
  const app = express();
  app.locals.mockDataPath = mockDataPath;
  app.locals.dashboardConfig = config;

  /** So `getCurrentDate()` resolves `date-config.json` under detected mock-data, not cwd fallbacks */
  initializeDateManipulation({ mockDataPath });

  // Middleware
  const jsonBodyLimit = getDashboardJsonBodyLimit();
  app.use(express.json({ limit: jsonBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));

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
  app.use('/api/proxy-config', proxyConfigRouter);
  app.use('/api/client-lanes', clientLanesRouter);
  
  // Log route registration (for debugging)
  console.log(
    '[Server] Registered API routes: /api/mocks, /api/stats, /api/health, /api/date-config, /api/scenario-config (export/import), /api/proxy, /api/proxy-config, /api/client-lanes'
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

