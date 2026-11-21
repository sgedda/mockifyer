// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

// Initialize mockifyer before any other imports
import { initializeMockifyer } from './lib/mockifyer';
initializeMockifyer();

// Other imports after mockifyer is initialized
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
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
import {
  buildHtmlForRoute,
  buildNotFoundHtml,
  getHtmlRoutes,
  resolvePrerenderedHtmlPath,
} from './lib/seo-html';

const app = express();
const port = process.env.PORT || 3000;

// Trust proxy to get correct IP addresses (important for IP-based vote tracking)
app.set('trust proxy', true);

// Disable x-powered-by header
app.disable('x-powered-by');

// Compression middleware (gzip + Brotli support via Node's native support)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    const contentType = res.getHeader('Content-Type') as string || '';
    return /text|javascript|json|xml|css|svg|markdown/.test(contentType);
  },
  threshold: 1024, // Only compress responses > 1KB
}));

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Trailing slash redirect (301) - must be before other routes
// Only redirect GET/HEAD requests. Pair with express.static({ redirect: false })
// so directory-backed paths like /guides cannot loop with /guides/.
app.use((req, res, next) => {
  if (
    (req.method === 'GET' || req.method === 'HEAD') &&
    req.path !== '/' &&
    req.path.endsWith('/')
  ) {
    const query = req.url.slice(req.path.length);
    const safePath = req.path.slice(0, -1);
    return res.redirect(301, safePath + query);
  }
  next();
});

// Server-side 301 redirects
const REDIRECTS: Record<string, string> = {
  '/playground': '/getting-started',
  '/settings': '/date-config',
  '/timeline': '/dashboard#network',
  '/index.html': '/',
  '/browser-guide': '/guides/browser-record-replay',
};

app.use((req, res, next) => {
  const redirect = REDIRECTS[req.path];
  if (redirect) {
    return res.redirect(301, redirect);
  }
  next();
});

// WWW to apex redirect (301) - Railway proxies, so check X-Forwarded-Host first
app.use((req, res, next) => {
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostHeader = req.headers.host;
  const host = (
    (typeof forwardedHost === 'string' ? forwardedHost : forwardedHost?.[0]) ||
    (typeof hostHeader === 'string' ? hostHeader : hostHeader?.[0]) ||
    ''
  ).toLowerCase();
  if (host === 'www.mockifyer.dev') {
    const redirectUrl = `https://mockifyer.dev${req.url}`;
    return res.redirect(301, redirectUrl);
  }
  next();
});

// Middleware
app.use(cors({
  origin: true,
  credentials: true, // Allow cookies to be sent
}));
app.use(express.json());
app.use(cookieParser());

// Cross-origin isolation for browser guide page only (needed for StackBlitz WebContainer embed)
// Applied before static file serving so it works for the SPA route
app.use((req, res, next) => {
  if (req.path === '/guides/browser-record-replay' || req.path === '/guides/browser-record-replay/') {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  }
  next();
});

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

/**
 * Remote Jest execution is disabled.
 * The previous handler wrote the request body to a temp file and ran `npx jest`,
 * which executes arbitrary code in the public web process. Generating a test
 * string locally (`POST /api/test/generate`) does not run it.
 */
app.post('/api/test/run', (_req: express.Request, res: express.Response) => {
  res.status(410).json({
    success: false,
    error: 'Remote test execution is disabled',
  });
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
        mockifyerEnabled: process.env.MOCKIFYER_MODE === 'on',
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
        mockifyerEnabled: process.env.MOCKIFYER_MODE === 'on',
        recordMode: process.env.MOCKIFYER_RECORD === 'true',
        mockDataPath: process.env.MOCKIFYER_PATH || 'Not set (using default)',
        maxScenarios: process.env.MOCKIFYER_MAX_SCENARIOS ? parseInt(process.env.MOCKIFYER_MAX_SCENARIOS, 10) : null,
        maxRequestsPerScenario: process.env.MOCKIFYER_MAX_REQUESTS_PER_SCENARIO ? parseInt(process.env.MOCKIFYER_MAX_REQUESTS_PER_SCENARIO, 10) : null
      }
    });
  }
});

// Serve static assets (JS, CSS, etc.) from public directory with cache headers
app.use('/assets', express.static(path.join(__dirname, '../public/assets'), {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, filepath) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

// Serve videos with long cache (they have hash-based filenames)
app.use('/videos', express.static(path.join(__dirname, '../public/videos'), {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, filepath) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

// Markdown / llms.txt: explicit content types for crawlers
app.use((req, res, next) => {
  if ((req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api/')) {
    if (req.path.endsWith('.md')) {
      res.type('text/markdown; charset=utf-8');
    } else if (req.path.endsWith('.txt')) {
      res.type('text/plain; charset=utf-8');
    }
  }
  next();
});

// Serve static files from public directory (but not for API routes).
// redirect: false prevents express.static from 301'ing /guides → /guides/
// when public/guides/ exists for nested guide HTML files.
app.use((req, res, next) => {
  // Only serve static files for GET/HEAD requests that aren't API routes
  if ((req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api/')) {
    express.static(path.join(__dirname, '../public'), { redirect: false })(req, res, next);
  } else {
    next();
  }
});

// Known HTML routes — prefer seo-manifest.json (written by prerender), with a
// static fallback so local/dev without prerender still recognizes pages.
const HTML_ROUTES_FALLBACK = [
  '/',
  '/getting-started',
  '/date-config',
  '/config-reference',
  '/contact',
  '/e2e-tutorial',
  '/features',
  '/faq',
  '/packages',
  '/dashboard',
  '/comparisons',
  '/guides',
  '/guides/mock-at-the-network-edge',
  '/guides/reproduce-tester-bugs',
  '/guides/stable-react-native-e2e',
  '/guides/mock-drift',
  '/guides/mockifyer-atlas',
  '/guides/react-native-without-msw',
  '/guides/browser-record-replay',
];

function getKnownHtmlRoutes(): string[] {
  const fromManifest = getHtmlRoutes();
  return fromManifest.length > 0 ? fromManifest : HTML_ROUTES_FALLBACK;
}

// SPA / prerendered HTML fallback (GET requests only)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found', path: req.path });
  }
  if (req.path.startsWith('/assets/') || req.path.startsWith('/videos/')) {
    return res.status(404).send('Asset not found');
  }

  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.type('html');

  const isKnownRoute = getKnownHtmlRoutes().includes(req.path);

  if (isKnownRoute) {
    // Prefer on-disk prerendered file (sendFile for correct etag/range)
    const prerenderedPath = resolvePrerenderedHtmlPath(req.path);
    if (prerenderedPath) {
      return res.sendFile(prerenderedPath);
    }

    // Serve-time injection fallback if prerender output is missing
    const built = buildHtmlForRoute(req.path);
    if (built) {
      return res.status(built.status).send(built.html);
    }

    // Last resort for local/dev without public assets
    const indexPath = path.join(__dirname, '../public/index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }

  // Unknown routes: 404 with dedicated head (noindex), not the homepage shell
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return res.status(404).send(buildNotFoundHtml());
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server (bind 0.0.0.0 so PaaS health checks can reach the process)
if (process.env.NODE_ENV !== 'test') {
  const host = process.env.HOST || '0.0.0.0';
  app.listen(Number(port), host, () => {
    console.log(`Server is running on ${host}:${port}`);
  });
}

export default app; 