// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

// Initialize mockifyer before any other imports
import { initializeMockifyer } from './lib/mockifyer';
initializeMockifyer();

// Other imports after mockifyer is initialized
import express from 'express';
import cors from 'cors';
import path from 'path';
import { weatherRouter } from './routes/weather';
import { footballRouter } from './routes/football';
import { mocksRouter } from './routes/mocks';
import { graphqlRouter } from './routes/graphql';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/weather', weatherRouter);
app.use('/api/football', footballRouter);
app.use('/api/mocks', mocksRouter);
app.use('/api/graphql', graphqlRouter);

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Status endpoint for dashboard
app.get('/api/status', (req: express.Request, res: express.Response) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Get mockifyer version from package.json (works for both local and published)
    let mockifyerVersion = 'unknown';
    try {
      // Try to read from the local linked package (file:../../)
      const mockifyerPackagePath = path.join(__dirname, '../../../package.json');
      if (fs.existsSync(mockifyerPackagePath)) {
        const mockifyerPackage = JSON.parse(fs.readFileSync(mockifyerPackagePath, 'utf-8'));
        mockifyerVersion = mockifyerPackage?.version || 'unknown';
      } else {
        // Try to read from node_modules
        const nodeModulesPath = path.join(__dirname, '../../node_modules/@sgedda/mockifyer/package.json');
        if (fs.existsSync(nodeModulesPath)) {
          const mockifyerPackage = JSON.parse(fs.readFileSync(nodeModulesPath, 'utf-8'));
          mockifyerVersion = mockifyerPackage?.version || 'unknown';
        }
      }
    } catch (e) {
      console.warn('[Status] Could not determine mockifyer version:', e);
    }
    
    // Get deployment date from environment variable or use current time
    const deployedDate = process.env.DEPLOYED_DATE || new Date().toISOString();
    
    res.json({
      mockifyerVersion,
      deployedDate,
      githubRepo: 'https://github.com/sgedda/mockifyer'
    });
  } catch (error) {
    console.error('[Status] Error:', error);
    res.json({
      mockifyerVersion: 'unknown',
      deployedDate: new Date().toISOString(),
      githubRepo: 'https://github.com/sgedda/mockifyer'
    });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

export default app; 