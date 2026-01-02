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
import { weatherFetchRouter } from './routes/weather-fetch';
import { weatherUnifiedRouter } from './routes/weather-unified';
import { footballRouter } from './routes/football';
import { footballUnifiedRouter } from './routes/football-unified';
import { mocksRouter } from './routes/mocks';
import { graphqlRouter } from './routes/graphql';
import { graphqlUnifiedRouter } from './routes/graphql-unified';
import { dateConfigRouter } from './routes/date-config';
import { dateDemoRouter } from './routes/date-demo';
import { dateExampleRouter } from './routes/date-example';
import { eventsRouter } from './routes/events';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API routes - must be registered BEFORE static file serving
app.use('/api/weather', weatherRouter);
app.use('/api/weather-fetch', weatherFetchRouter);
app.use('/api/weather-unified', weatherUnifiedRouter);
app.use('/api/football', footballRouter);
app.use('/api/football-unified', footballUnifiedRouter);
app.use('/api/mocks', mocksRouter);
app.use('/api/graphql', graphqlRouter);
app.use('/api/graphql-unified', graphqlUnifiedRouter);
app.use('/api/date-config', dateConfigRouter);
app.use('/api/date-demo', dateDemoRouter);
app.use('/api/date-example', dateExampleRouter);
app.use('/api/events', eventsRouter);

// Serve static assets (JS, CSS, etc.) from public directory
app.use('/assets', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    express.static(path.join(__dirname, '../public/assets'))(req, res, next);
  } else {
    next();
  }
});

// Serve static files from public directory (but not for API routes)
app.use((req, res, next) => {
  // Only serve static files for GET/HEAD requests that aren't API routes
  if ((req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api/')) {
    express.static(path.join(__dirname, '../public'))(req, res, next);
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
  res.sendFile(path.join(__dirname, '../public/index.html'));
});


// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Status endpoint for dashboard
app.get('/api/status', (req: express.Request, res: express.Response) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Get mockifyer version from separated packages (works for both local and published)
    let mockifyerVersion = 'unknown';
    const packageVersions: Record<string, string> = {};
    
    try {
      // Try to find versions from separated packages (check core, axios, and fetch)
      const packagesToCheck = ['@sgedda/mockifyer-core', '@sgedda/mockifyer-axios', '@sgedda/mockifyer-fetch'];
      
      for (const packageName of packagesToCheck) {
        const shortName = packageName.replace('@sgedda/mockifyer-', '');
        const possiblePaths = [
          // Local development: packages directory (most common for file: dependencies)
          path.join(__dirname, `../../../packages/mockifyer-${shortName}/package.json`),
          // Production: node_modules from dist/
          path.join(__dirname, `../../node_modules/${packageName}/package.json`),
          // Production: node_modules from root
          path.join(__dirname, `../../../node_modules/${packageName}/package.json`),
          // Alternative: try require.resolve (works for installed packages)
          (() => {
            try {
              return require.resolve(`${packageName}/package.json`);
            } catch {
              return null;
            }
          })()
        ].filter(p => p !== null);
        
        for (const packagePath of possiblePaths) {
          if (fs.existsSync(packagePath)) {
            try {
              const mockifyerPackage = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
              if (mockifyerPackage?.version) {
                packageVersions[shortName] = mockifyerPackage.version;
                break;
              }
            } catch (e) {
              console.warn(`[Status] Could not read package.json at ${packagePath}:`, e);
            }
          }
        }
      }
      
      // Fallback: try to read from this project's package.json and resolve file: dependencies
      if (Object.keys(packageVersions).length === 0) {
        const thisPackagePath = path.join(__dirname, '../../package.json');
        if (fs.existsSync(thisPackagePath)) {
          try {
            const thisPackage = JSON.parse(fs.readFileSync(thisPackagePath, 'utf-8'));
            // Check for separated packages
            for (const packageName of packagesToCheck) {
              const shortName = packageName.replace('@sgedda/mockifyer-', '');
              const depVersion = thisPackage.dependencies?.[packageName] || 
                               thisPackage.devDependencies?.[packageName];
              if (depVersion) {
                // Handle file: dependencies
                if (depVersion.startsWith('file:')) {
                  const relativePath = depVersion.replace(/^file:/, '');
                  const absolutePath = path.isAbsolute(relativePath) 
                    ? relativePath 
                    : path.join(path.dirname(thisPackagePath), relativePath);
                  const packageJsonPath = path.join(absolutePath, 'package.json');
                  if (fs.existsSync(packageJsonPath)) {
                    try {
                      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                      if (pkg?.version) {
                        packageVersions[shortName] = pkg.version;
                      }
                    } catch (e) {
                      console.warn(`[Status] Could not read file: dependency package.json:`, e);
                    }
                  }
                } else {
                  // Extract version from semver string (remove ^, ~, etc.)
                  const version = depVersion.replace(/^[\^~]/, '').trim();
                  if (version && version.match(/^\d+\.\d+\.\d+/)) {
                    packageVersions[shortName] = version;
                  }
                }
              }
            }
          } catch (e) {
            console.warn('[Status] Could not read project package.json:', e);
          }
        }
      }
      
      // Format version string
      if (Object.keys(packageVersions).length > 0) {
        const versions = Object.entries(packageVersions)
          .map(([name, version]) => `${name}@${version}`)
          .join(', ');
        mockifyerVersion = versions;
      } else {
        console.warn('[Status] Could not find any Mockifyer package versions');
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
      githubRepo: 'https://github.com/sgedda/mockifyer',
      runtimeConfig: {
        mockifyerEnabled: process.env.MOCKIFYER_ENABLED === 'true',
        recordMode: process.env.MOCKIFYER_RECORD === 'true',
        mockDataPath: process.env.MOCKIFYER_PATH || 'Not set (using default)'
      }
    });
  } catch (error) {
    console.error('[Status] Error:', error);
    res.json({
      mockifyerVersion: 'unknown',
      deployedDate: new Date().toISOString(),
      githubRepo: 'https://github.com/sgedda/mockifyer',
      runtimeConfig: {
        mockifyerEnabled: process.env.MOCKIFYER_ENABLED === 'true',
        recordMode: process.env.MOCKIFYER_RECORD === 'true',
        mockDataPath: process.env.MOCKIFYER_PATH || 'Not set (using default)'
      }
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