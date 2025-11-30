import express from 'express';
import path from 'path';
import { mocksRouter } from './routes/mocks';
import { statsRouter } from './routes/stats';
import { healthRouter } from './routes/health';

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

  // Serve static files
  app.use(express.static(publicDir));

  // Fallback to index.html for SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

