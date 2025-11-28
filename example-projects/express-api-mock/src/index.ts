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
import { test } from './routes/test';
import { weatherFetchRouter } from './routes/weather-fetch';
import { footballRouter } from './routes/football';
import { mocksRouter } from './routes/mocks';
import { graphqlRouter } from './routes/graphql';
import { dateConfigRouter } from './routes/date-config';
import { dateDemoRouter } from './routes/date-demo';
import { dateExampleRouter } from './routes/date-example';
import { eventsRouter } from './routes/events';
import { setupMockifyer } from '@sgedda/mockifyer';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api', test);
app.use('/api/weather', weatherRouter);
app.use('/api/weather-fetch', weatherFetchRouter);
app.use('/api/football', footballRouter);
app.use('/api/mocks', mocksRouter);
app.use('/api/graphql', graphqlRouter);
app.use('/api/date-config', dateConfigRouter);
app.use('/api/date-demo', dateDemoRouter);
app.use('/api/date-example', dateExampleRouter);
app.use('/api/events', eventsRouter);


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
      // Try multiple paths to find the mockifyer package
      const possiblePaths = [
        // Production: node_modules from dist/
        path.join(__dirname, '../../node_modules/@sgedda/mockifyer/package.json'),
        // Production: node_modules from root
        path.join(__dirname, '../../../node_modules/@sgedda/mockifyer/package.json'),
        // Local development: linked package
        path.join(__dirname, '../../../package.json'),
        // Alternative: try require.resolve
        (() => {
          try {
            return require.resolve('@sgedda/mockifyer/package.json');
          } catch {
            return null;
          }
        })()
      ].filter(p => p !== null);
      
      for (const packagePath of possiblePaths) {
        if (fs.existsSync(packagePath)) {
          const mockifyerPackage = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
          if (mockifyerPackage?.version) {
            mockifyerVersion = mockifyerPackage.version;
            break;
          }
        }
      }
      
      // Fallback: try to read from this project's package.json dependencies
      if (mockifyerVersion === 'unknown') {
        const thisPackagePath = path.join(__dirname, '../../package.json');
        if (fs.existsSync(thisPackagePath)) {
          const thisPackage = JSON.parse(fs.readFileSync(thisPackagePath, 'utf-8'));
          const depVersion = thisPackage.dependencies?.['@sgedda/mockifyer'] || 
                           thisPackage.devDependencies?.['@sgedda/mockifyer'];
          if (depVersion && depVersion !== 'file:../../') {
            // Extract version from semver string (remove ^, ~, etc.)
            mockifyerVersion = depVersion.replace(/^[\^~]/, '');
          }
        }
      }
    } catch (e) {
      console.warn('[Status] Could not determine mockifyer version:', e);
    }
    
    // Get deployment date from build-time file or environment variable
    let deployedDate = process.env.DEPLOYED_DATE;
    
    if (!deployedDate) {
      // Try to read from build-time file (created during Railway build)
      const buildInfoPaths = [
        path.join(__dirname, '../build-info.json'),  // From dist/
        path.join(__dirname, '../../public/build-info.json'),  // From public/
        path.join(process.cwd(), 'public/build-info.json')  // Absolute path
      ];
      
      for (const buildInfoPath of buildInfoPaths) {
        if (fs.existsSync(buildInfoPath)) {
          try {
            const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf-8'));
            if (buildInfo.deployedDate) {
              deployedDate = buildInfo.deployedDate;
              break;
            }
          } catch (e) {
            console.warn('[Status] Could not read build-info.json:', e);
          }
        }
      }
    }
    
    // Fallback to current time if nothing found (shouldn't happen in production)
    if (!deployedDate) {
      deployedDate = new Date().toISOString();
    }
    
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