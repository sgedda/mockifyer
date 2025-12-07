import express from 'express';
import path from 'path';
import { mocksRouter } from './routes/mocks';
import { statsRouter } from './routes/stats';
import { healthRouter } from './routes/health';
import { dateConfigRouter } from './routes/date-config';

export function createServer(publicDir: string, mockDataPath: string): express.Application {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
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

  // API routes
  app.use('/api/mocks', mocksRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/health', healthRouter);
  app.use('/api/date-config', dateConfigRouter);
  
  // Log route registration (for debugging)
  console.log('[Server] Registered API routes: /api/mocks, /api/stats, /api/health, /api/date-config');

  // Serve static files
  app.use(express.static(publicDir));

  // Fallback to index.html for SPA routing (but not for API routes)
  app.get('*', (req, res, next) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found', path: req.path });
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

