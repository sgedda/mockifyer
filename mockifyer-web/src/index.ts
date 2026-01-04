// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

// Initialize mockifyer before any other imports
import { initializeMockifyer } from './lib/mockifyer';
initializeMockifyer();

// Other imports after mockifyer is initialized
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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
import { featureVotesRouter } from './routes/feature-votes';
import { linearFeaturesRouter } from './routes/linear-features';
import { scenarioConfigRouter } from './routes/scenario-config';
import { contactRouter } from './routes/contact';

const app = express();
const port = process.env.PORT || 3000;

// Trust proxy to get correct IP addresses (important for IP-based vote tracking)
app.set('trust proxy', true);

// Middleware
app.use(cors({
  origin: true,
  credentials: true, // Allow cookies to be sent
}));
app.use(express.json());
app.use(cookieParser());

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
app.use('/api/feature-votes', featureVotesRouter);
app.use('/api/linear-features', linearFeaturesRouter);
app.use('/api/scenario-config', scenarioConfigRouter);
app.use('/api/contact', contactRouter);

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test generation endpoint
app.post('/api/test/generate', (req: express.Request, res: express.Response) => {
  try {
    const { mockData, httpClientType = 'fetch' } = req.body;
    
    if (!mockData) {
      return res.status(400).json({ error: 'Mock data is required' });
    }

    const { TestGenerator } = require('@sgedda/mockifyer-core');
    const generator = new TestGenerator();
    
    const testCode = generator.generateTest(mockData, {
      framework: 'jest',
      httpClientType,
      includeSetup: true,
      mockDataPath: './mock-data',
    });
    
    res.json({ testCode });
  } catch (error: any) {
    console.error('[Test Generation Error]:', error);
    res.status(500).json({
      error: error.message,
      testCode: `// Error generating test: ${error.message}\n// Please ensure @sgedda/mockifyer-core is available`,
    });
  }
});

// Test execution endpoint
app.post('/api/test/run', async (req: express.Request, res: express.Response) => {
  try {
    const { testCode, mockData } = req.body;
    
    if (!testCode) {
      return res.status(400).json({ error: 'Test code is required' });
    }

    const fs = require('fs');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const os = require('os');
    const tmpDir = path.join(os.tmpdir(), 'mockifyer-tests');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    // Create a temporary test file
    const testFileName = `test-${Date.now()}.test.ts`;
    const testFilePath = path.join(tmpDir, testFileName);
    
    // Write test code to file
    fs.writeFileSync(testFilePath, testCode, 'utf-8');
    
    // Create a temporary jest config if needed
    const jestConfigPath = path.join(tmpDir, 'jest.config.js');
    if (!fs.existsSync(jestConfigPath)) {
      const jestConfig = `
module.exports = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@sgedda/mockifyer-core$': '${path.join(process.cwd(), 'node_modules/@sgedda/mockifyer-core/dist/index.js').replace(/\\/g, '/')}',
    '^@sgedda/mockifyer-fetch$': '${path.join(process.cwd(), 'node_modules/@sgedda/mockifyer-fetch/dist/index.js').replace(/\\/g, '/')}',
    '^@sgedda/mockifyer-axios$': '${path.join(process.cwd(), 'node_modules/@sgedda/mockifyer-axios/dist/index.js').replace(/\\/g, '/')}',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { esModuleInterop: true } }],
  },
  collectCoverage: false,
  verbose: true,
};
`;
      fs.writeFileSync(jestConfigPath, jestConfig, 'utf-8');
    }
    
    // Run Jest on the test file
    const jestCommand = `npx jest "${testFilePath}" --config="${jestConfigPath}" --no-coverage --json`;
    
    try {
      const { stdout, stderr } = await execAsync(jestCommand, {
        cwd: process.cwd(),
        timeout: 30000, // 30 second timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
      
      let testResults;
      try {
        testResults = JSON.parse(stdout);
      } catch (e) {
        // If JSON parsing fails, try to extract info from stdout
        testResults = {
          success: stdout.includes('PASS') || stdout.includes('✓'),
          numPassedTests: stdout.match(/(\d+) passed/)?.[1] || '0',
          numFailedTests: stdout.match(/(\d+) failed/)?.[1] || '0',
          output: stdout,
          error: stderr,
        };
      }
      
      // Clean up test file
      try {
        fs.unlinkSync(testFilePath);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      res.json({
        success: testResults.success || testResults.numFailedTests === 0,
        results: testResults,
        output: stdout,
        error: stderr || null,
      });
    } catch (execError: any) {
      // Jest execution failed
      let errorOutput = execError.stdout || execError.stderr || execError.message;
      
      // Try to parse Jest JSON output even from errors
      let testResults;
      try {
        testResults = JSON.parse(execError.stdout || '{}');
      } catch (e) {
        testResults = {
          success: false,
          numFailedTests: 1,
          numPassedTests: 0,
          testResults: [],
        };
      }
      
      // Clean up test file
      try {
        fs.unlinkSync(testFilePath);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      res.json({
        success: false,
        results: testResults,
        output: execError.stdout || '',
        error: errorOutput,
      });
    }
  } catch (error: any) {
    console.error('[Test Execution Error]:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      output: '',
    });
  }
});

// Status endpoint for dashboard (must be BEFORE catch-all route)
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
      
      // First, try to resolve packages directly using require.resolve (works for file: dependencies too)
      for (const packageName of packagesToCheck) {
        const shortName = packageName.replace('@sgedda/mockifyer-', '');
        try {
          // Try to require the package and get its version from package.json
          const packageMain = require.resolve(packageName);
          // Find package.json by walking up from the main file
          let currentPath = path.dirname(packageMain);
          for (let i = 0; i < 10; i++) {
            const pkgJsonPath = path.join(currentPath, 'package.json');
            if (fs.existsSync(pkgJsonPath)) {
              try {
                const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
                if (pkg.name === packageName && pkg.version) {
                  packageVersions[shortName] = pkg.version;
                  console.log(`[Status] Found ${packageName} version ${pkg.version} via require.resolve at ${pkgJsonPath}`);
                  break;
                }
              } catch (e) {
                // Continue searching
              }
            }
            const parent = path.dirname(currentPath);
            if (parent === currentPath) break;
            currentPath = parent;
          }
        } catch (e) {
          // Package not found via require.resolve, will try file paths below
          console.log(`[Status] require.resolve failed for ${packageName}, trying file paths...`);
        }
      }
      
      // If we didn't find all versions via require.resolve, try file paths for missing ones
      for (const packageName of packagesToCheck) {
        const shortName = packageName.replace('@sgedda/mockifyer-', '');
        if (packageVersions[shortName]) {
          continue; // Already found via require.resolve
        }
        
        const possiblePaths = [
          // Check node_modules first (file: dependencies are symlinked here)
          path.join(process.cwd(), `node_modules/${packageName}/package.json`),
          path.join(__dirname, `../../node_modules/${packageName}/package.json`),
          path.join(__dirname, `../../../node_modules/${packageName}/package.json`),
          // Local development: packages directory (source)
          path.join(process.cwd(), `packages/mockifyer-${shortName}/package.json`),
          path.join(__dirname, `../../../packages/mockifyer-${shortName}/package.json`),
        ];
        
        for (const packagePath of possiblePaths) {
          if (fs.existsSync(packagePath)) {
            try {
              const mockifyerPackage = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
              if (mockifyerPackage?.name === packageName && mockifyerPackage?.version) {
                packageVersions[shortName] = mockifyerPackage.version;
                console.log(`[Status] Found ${packageName} version ${mockifyerPackage.version} at ${packagePath}`);
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
        const thisPackagePaths = [
          path.join(__dirname, '../../package.json'), // From dist/
          path.join(process.cwd(), 'package.json'), // From project root
        ];
        let thisPackagePath: string | null = null;
        for (const pkgPath of thisPackagePaths) {
          if (fs.existsSync(pkgPath)) {
            thisPackagePath = pkgPath;
            break;
          }
        }
        if (thisPackagePath) {
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
        console.warn('[Status] __dirname:', __dirname);
        console.warn('[Status] process.cwd():', process.cwd());
        // Try one more direct approach - check if packages exist at expected location
        try {
          const directPath = path.join(process.cwd(), 'packages/mockifyer-core/package.json');
          if (fs.existsSync(directPath)) {
            const pkg = JSON.parse(fs.readFileSync(directPath, 'utf-8'));
            if (pkg.version) {
              mockifyerVersion = `core@${pkg.version}`;
              console.log('[Status] Found version via direct path:', mockifyerVersion);
            }
          }
        } catch (e) {
          console.warn('[Status] Direct path check also failed:', e);
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
      githubRepo: 'https://github.com/sgedda/mockifyer',
      runtimeConfig: {
        mockifyerEnabled: process.env.MOCKIFYER_ENABLED === 'true',
        recordMode: process.env.MOCKIFYER_RECORD === 'true',
        mockDataPath: process.env.MOCKIFYER_PATH || 'Not set (using default)',
        maxScenarios: process.env.MOCKIFYER_MAX_SCENARIOS ? parseInt(process.env.MOCKIFYER_MAX_SCENARIOS, 10) : null,
        maxRequestsPerScenario: process.env.MOCKIFYER_MAX_REQUESTS_PER_SCENARIO ? parseInt(process.env.MOCKIFYER_MAX_REQUESTS_PER_SCENARIO, 10) : null
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
        mockDataPath: process.env.MOCKIFYER_PATH || 'Not set (using default)',
        maxScenarios: process.env.MOCKIFYER_MAX_SCENARIOS ? parseInt(process.env.MOCKIFYER_MAX_SCENARIOS, 10) : null,
        maxRequestsPerScenario: process.env.MOCKIFYER_MAX_REQUESTS_PER_SCENARIO ? parseInt(process.env.MOCKIFYER_MAX_REQUESTS_PER_SCENARIO, 10) : null
      }
    });
  }
});

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