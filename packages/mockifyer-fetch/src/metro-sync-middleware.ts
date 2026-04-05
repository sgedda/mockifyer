/**
 * Metro middleware for mock file synchronization
 * 
 * Provides sync mechanisms:
 * 1. POST /mockifyer-save - Direct save endpoint (used by Hybrid Provider for instant sync)
 * 2. GET /mockifyer-sync-to-device-manifest + /mockifyer-sync-to-device-file - Project → app (HybridProvider; avoids huge single JSON)
 * 3. GET /mockifyer-sync-to-device - Legacy: all files in one response (may fail on large scenarios)
 * 4. GET /mockifyer-sync - Legacy: iOS simulator mock-data → project folder
 * 
 * The Hybrid Provider (recommended) uses POST /mockifyer-save for instant file sync.
 * Legacy polling-based sync is still available for backward compatibility.
 * 
 * Usage: Add to metro.config.js middleware array
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { MockData, TestGenerator, TestGenerationOptions } from '@sgedda/mockifyer-core';
import { logger } from '@sgedda/mockifyer-core';

export interface MetroSyncMiddlewareOptions {
  /** Project root directory (default: process.cwd()) */
  projectRoot?: string;
  /** Path to mock data directory relative to project root (default: 'mock-data') */
  mockDataPath?: string;
  /** Test generation configuration - tests are generated when mocks are saved to project folder */
  testGeneration?: {
    /** Enable automatic test generation when mocks are saved */
    enabled?: boolean;
    /** Test framework to use: 'jest' (default), 'vitest', or 'mocha' */
    framework?: 'jest' | 'vitest' | 'mocha';
    /** Output path for generated tests (default: './tests/generated') */
    outputPath?: string;
    /** Test file naming pattern with placeholders: {endpoint}, {method}, {scenario} (default: '{endpoint}.test.ts') */
    testPattern?: string;
    /** Include setup code in generated tests (default: true) */
    includeSetup?: boolean;
    /** Group tests by: 'endpoint', 'scenario', or 'file' (default: 'endpoint') */
    groupBy?: 'endpoint' | 'scenario' | 'file';
    /** If true, only generate one test per endpoint (method + pathname), ignoring query parameters (default: false) */
    uniqueTestsPerEndpoint?: boolean;
  };
}

const DEFAULT_SCENARIO = 'default';

let autoSyncInterval: NodeJS.Timeout | null = null;

function getMockFilePathLocal(mockData: MockData, dateStr: string): { dir: string; filename: string } {
  const url = mockData.request.url || '';
  const method = (mockData.request.method || 'GET').toUpperCase();
  let host = 'unknown';
  let pathSegments: string[] = [];
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    pathSegments = parsed.pathname.split('/').filter(Boolean);
  } catch {
    return { dir: 'unknown', filename: `${method}_${dateStr}.json` };
  }
  const hostSafe = host.replace(/[^a-zA-Z0-9.-]/g, '_');
  const graphqlIdx = pathSegments.lastIndexOf('graphql');
  const restIdx = pathSegments.indexOf('rest');
  let type: string;
  let remainingSegments: string[];
  if (graphqlIdx >= 0) {
    type = 'graphql';
    remainingSegments = pathSegments.slice(graphqlIdx + 1);
  } else if (restIdx >= 0) {
    type = 'rest';
    remainingSegments = pathSegments.slice(restIdx + 1);
  } else {
    type = '';
    remainingSegments = pathSegments;
  }
  let identifier = '';
  if (mockData.request.data) {
    try {
      const body = typeof mockData.request.data === 'string'
        ? JSON.parse(mockData.request.data) : mockData.request.data;
      if (body.operationName) identifier = body.operationName;
      else if (body.path) identifier = body.path;
      else if (body.webAppName) identifier = body.webAppName;
    } catch { /* ignore */ }
  }
  identifier = identifier.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60);
  const dir = [hostSafe, type, ...remainingSegments].filter(Boolean).join('/');
  const filename = identifier ? `${method}_${identifier}_${dateStr}.json` : `${method}_${dateStr}.json`;
  return { dir, filename };
}

/**
 * Get current scenario from scenario-config.json
 */
function getCurrentScenario(mockDataPath: string): string {
  // Check environment variable first
  if (process.env.MOCKIFYER_SCENARIO) {
    return process.env.MOCKIFYER_SCENARIO;
  }

  // Try to load from scenario-config.json
  try {
    const configPath = path.join(mockDataPath, 'scenario-config.json');
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(fileContent);
      if (config.currentScenario) {
        return config.currentScenario;
      }
    }
  } catch (error) {
    // Silently fail - file might not exist or be invalid
  }

  return DEFAULT_SCENARIO;
}

/**
 * Get scenario folder path
 */
function getScenarioPath(scenario: string, mockDataPath: string): string {
  // Always create scenario subfolder, even for 'default'
  return path.join(mockDataPath, scenario);
}


/**
 * Get test generation config from options or environment variables
 * Options take precedence, then fall back to environment variables (for backward compatibility)
 */
function getTestGenerationConfig(options?: MetroSyncMiddlewareOptions): TestGenerationOptions | null {
  // Check if enabled via options or environment variables
  const enabled = 
    options?.testGeneration?.enabled === true ||
    process.env.MOCKIFYER_GENERATE_TESTS === 'true' || 
    process.env.MOCKIFYER_GENERATE_TESTS === '1';
    
  if (!enabled) {
    return null;
  }

  // Use options if provided, otherwise fall back to environment variables
  return {
    framework: options?.testGeneration?.framework || (process.env.MOCKIFYER_TEST_FRAMEWORK as any) || 'jest',
    outputPath: options?.testGeneration?.outputPath || process.env.MOCKIFYER_TEST_OUTPUT_PATH || './tests/generated',
    testPattern: options?.testGeneration?.testPattern || process.env.MOCKIFYER_TEST_PATTERN || '{endpoint}.test.ts',
    includeSetup: options?.testGeneration?.includeSetup !== false && process.env.MOCKIFYER_TEST_INCLUDE_SETUP !== 'false',
    groupBy: options?.testGeneration?.groupBy || (process.env.MOCKIFYER_TEST_GROUP_BY as any) || 'endpoint',
    httpClientType: 'fetch',
    uniqueTestsPerEndpoint: options?.testGeneration?.uniqueTestsPerEndpoint || process.env.MOCKIFYER_UNIQUE_TESTS_PER_ENDPOINT === 'true',
  };
}

/**
 * Generate test file for a mock (runs in Metro/Node.js where fs is available)
 */
function generateTestForMock(
  mockData: MockData,
  testConfig: TestGenerationOptions,
  projectRoot: string
): boolean {
  try {
    // Try to require TestGenerator from mockifyer-core
    let TestGeneratorClass: typeof TestGenerator;
    try {
      let mockifyerCore;
      try {
        mockifyerCore = require('@sgedda/mockifyer-core');
      } catch (e) {
        // Fallback: try relative path (for local file: dependencies)
        const corePath = path.join(projectRoot, '../../packages/mockifyer-core/dist/index.js');
        if (fs.existsSync(corePath)) {
          mockifyerCore = require(corePath);
        } else {
          throw new Error(`Could not find mockifyer-core at ${corePath}`);
        }
      }
      
      TestGeneratorClass = mockifyerCore?.TestGenerator;
      
      if (!TestGeneratorClass) {
        const testGeneratorPath = path.join(projectRoot, '../../packages/mockifyer-core/dist/utils/test-generator.js');
        if (fs.existsSync(testGeneratorPath)) {
          const testGeneratorModule = require(testGeneratorPath);
          TestGeneratorClass = testGeneratorModule.TestGenerator;
        }
      }
    } catch (e) {
      return false;
    }

    if (!TestGeneratorClass) {
      return false;
    }

    const generator = new TestGeneratorClass();
    
    const options: TestGenerationOptions = {
      framework: testConfig.framework,
      outputPath: testConfig.outputPath,
      testPattern: testConfig.testPattern,
      includeSetup: testConfig.includeSetup,
      groupBy: testConfig.groupBy,
      httpClientType: testConfig.httpClientType,
      uniqueTestsPerEndpoint: testConfig.uniqueTestsPerEndpoint,
    };

    const testInfo = generator.analyzeMock(mockData, options.httpClientType || 'fetch');
    const testFilePath = generator.determineTestFilePath(mockData, options);
    
    const absoluteTestPath = path.resolve(projectRoot, testFilePath);
    const testDir = path.dirname(absoluteTestPath);

    // If uniqueTestsPerEndpoint is enabled, check if a test file already exists
    if (options.uniqueTestsPerEndpoint && fs.existsSync(absoluteTestPath)) {
      return true;
    }

    // Ensure test directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const testCode = generator.generateTest(mockData, options);

    // Check if test file already exists
    if (fs.existsSync(absoluteTestPath)) {
      const testName = `${testInfo.method} ${testInfo.endpoint}`;
      
      const existingContent = fs.readFileSync(absoluteTestPath, 'utf-8');
      if (existingContent.includes(`it('${testName}'`) || existingContent.includes(`it("${testName}"`)) {
        return true;
      }
      
      // Append test to existing file
      const testMatch = testCode.match(/it\('.*?', async \(\) => \{[\s\S]*?\}\);?/);
      if (testMatch) {
        const newTest = testMatch[0];
        const updatedContent = existingContent.replace(
          /(\s+)(\}\);?\s*)$/,
          `$1${newTest}\n$1$2`
        );
        fs.writeFileSync(absoluteTestPath, updatedContent);
        return true;
      }
    } else {
      // Create new test file
      fs.writeFileSync(absoluteTestPath, testCode);
    }

    return true;
  } catch (error) {
    logger.error(`[MockSync] ❌ Error generating test:`, error);
    return false;
  }
}

/**
 * Save mock data directly to project folder
 * Called by HybridProvider when saving mocks
 */
function saveMockToProjectFolder(
  mockData: MockData,
  projectRoot: string,
  mockDataPath: string,
  testConfig: TestGenerationOptions | null
): { success: boolean; filename?: string; scenario?: string; error?: string; skipped?: boolean; reason?: string } {
  try {
    // CRITICAL: Never save Mockifyer sync endpoint requests to prevent infinite loops
    const url = mockData?.request?.url || '';
    if (url.includes('/mockifyer-save') || url.includes('/mockifyer-clear') || url.includes('/mockifyer-sync')) {
      console.warn(`[MockSync] ⚠️ Rejecting save - Mockifyer sync endpoint detected: ${url}`);
      return { success: false, error: 'Cannot save Mockifyer sync endpoint requests' };
    }
    
    // Also check if the mockData string contains nested sync requests
    const mockDataStr = JSON.stringify(mockData);
    if (mockDataStr.includes('/mockifyer-save') || mockDataStr.includes('/mockifyer-clear') || mockDataStr.includes('/mockifyer-sync')) {
      logger.warn(`[MockSync] ⚠️ Rejecting save - Mock data contains nested Mockifyer sync requests`);
      return { success: false, error: 'Mock data contains nested Mockifyer sync requests' };
    }
    
    // Get current scenario and ensure scenario folder exists
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioPath(currentScenario, mockDataPath);
    fs.mkdirSync(scenarioPath, { recursive: true });

    const dateStr = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
    const { dir, filename } = getMockFilePathLocal(mockData, dateStr);
    const fullDir = path.join(scenarioPath, dir);
    const filePath = path.join(fullDir, filename);

    // Check if file already exists - skip saving if it does
    if (fs.existsSync(filePath)) {
      return { success: true, filename: path.join(dir, filename), skipped: true, reason: 'File already exists' };
    }

    fs.mkdirSync(fullDir, { recursive: true });
    // Write to file
    fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));

    // Generate test file if enabled
    if (testConfig) {
      generateTestForMock(mockData, testConfig, projectRoot);
    }

    return { success: true, filename: path.join(dir, filename), scenario: currentScenario };
  } catch (error) {
    console.error(`[MockSync] ❌ Error saving mock to project folder:`, error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Clear all mock files from project folder (current scenario)
 */
function clearMockFiles(mockDataPath: string): { success: boolean; filesDeleted?: number; error?: string } {
  try {
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioPath(currentScenario, mockDataPath);
    
    if (!fs.existsSync(scenarioPath)) {
      return { success: true, filesDeleted: 0 };
    }

    const files = fs.readdirSync(scenarioPath);
    let deleted = 0;

    files.forEach(file => {
      if (file.endsWith('.json')) {
        const filePath = path.join(scenarioPath, file);
        fs.unlinkSync(filePath);
        deleted++;
      }
    });

    return { success: true, filesDeleted: deleted };
  } catch (error) {
    logger.error(`[MockSync] ❌ Error clearing mock files:`, error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Sync mock files from iOS simulator to project folder
 */
function syncFromIOSSimulator(
  projectRoot: string,
  mockDataPath: string
): { success: boolean; filesSynced?: number; syncedFiles?: string[]; error?: string } {
  try {
    // Get iOS simulator path
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const simulatorPath = path.join(
      homeDir,
      'Library/Developer/CoreSimulator/Devices'
    );

    if (!fs.existsSync(simulatorPath)) {
      return { success: false, error: 'iOS Simulator path not found' };
    }

    // Find the most recent simulator device
    const devices = fs.readdirSync(simulatorPath);
    let latestDevice = '';
    let latestTime = 0;

    devices.forEach(device => {
      const devicePath = path.join(simulatorPath, device);
      const stat = fs.statSync(devicePath);
      if (stat.mtimeMs > latestTime) {
        latestTime = stat.mtimeMs;
        latestDevice = device;
      }
    });

    if (!latestDevice) {
      return { success: false, error: 'No iOS Simulator device found' };
    }

    // Look for mock-data directory in the simulator
    const appDataPath = path.join(
      simulatorPath,
      latestDevice,
      'data/Containers/Data/Application'
    );

    if (!fs.existsSync(appDataPath)) {
      return { success: false, error: 'iOS Simulator app data path not found' };
    }

    const apps = fs.readdirSync(appDataPath);
    let found = false;
    let filesSynced = 0;
    const syncedFiles: string[] = [];

    for (const app of apps) {
      const appPath = path.join(appDataPath, app);
      const mockDataSimPath = path.join(appPath, 'Documents/mock-data');

      if (fs.existsSync(mockDataSimPath)) {
        found = true;
        const currentScenario = getCurrentScenario(mockDataPath);
        const scenarioPath = getScenarioPath(currentScenario, mockDataPath);
        fs.mkdirSync(scenarioPath, { recursive: true });

        const files = fs.readdirSync(mockDataSimPath);
        files.forEach(file => {
          if (file.endsWith('.json')) {
            const sourcePath = path.join(mockDataSimPath, file);
            const destPath = path.join(scenarioPath, file);
            fs.copyFileSync(sourcePath, destPath);
            filesSynced++;
            syncedFiles.push(file);
          }
        });

        break;
      }
    }

    if (!found) {
      return { success: false, filesSynced: 0, error: 'mock-data directory not found in simulator' };
    }

    return { success: true, filesSynced, syncedFiles };
  } catch (error) {
    return { success: false, filesSynced: 0, error: (error as Error).message };
  }
}

/**
 * Recursive mock JSON files under scenario root (paths relative to scenario, POSIX slashes).
 */
function listScenarioMockJsonFiles(scenarioAbsPath: string): Array<{ relativePath: string; fullPath: string }> {
  const out: Array<{ relativePath: string; fullPath: string }> = [];
  if (!fs.existsSync(scenarioAbsPath)) {
    return out;
  }
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.json')) {
        const rel = path.relative(scenarioAbsPath, full);
        const relativePath = rel.split(path.sep).join('/');
        if (
          relativePath === 'scenario-config.json' ||
          relativePath === 'date-config.json'
        ) {
          continue;
        }
        out.push({ relativePath, fullPath: full });
      }
    }
  };
  walk(scenarioAbsPath);
  return out;
}

/**
 * Resolve a client-supplied path to a mock file under the scenario folder (blocks path traversal).
 */
function resolveScenarioRelativeMockPath(
  rawQueryPath: string,
  scenarioAbsPath: string
): { relativePath: string; fullPath: string } | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawQueryPath);
  } catch {
    return null;
  }
  const normalized = decoded.replace(/\\/g, '/').replace(/^\//, '');
  if (!normalized.endsWith('.json') || normalized.includes('..')) {
    return null;
  }
  const fullPath = path.normalize(path.join(scenarioAbsPath, normalized));
  const scenarioResolved = path.resolve(scenarioAbsPath);
  const relativeToScenario = path.relative(scenarioResolved, fullPath);
  if (relativeToScenario.startsWith('..') || path.isAbsolute(relativeToScenario)) {
    return null;
  }
  const relativePath = relativeToScenario.split(path.sep).join('/');
  return { relativePath, fullPath };
}

/**
 * Small manifest only (paths + mtimes) for GET /mockifyer-sync-to-device-manifest.
 */
function buildSyncToDeviceManifest(mockDataPath: string): {
  success: boolean;
  files?: Array<{ filename: string; modificationTime: number }>;
  count?: number;
  error?: string;
} {
  try {
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioPath(currentScenario, mockDataPath);
    const entries = listScenarioMockJsonFiles(scenarioPath);
    const files: Array<{ filename: string; modificationTime: number }> = [];
    for (const { relativePath, fullPath } of entries) {
      try {
        const stat = fs.statSync(fullPath);
        files.push({ filename: relativePath, modificationTime: stat.mtimeMs });
      } catch (e) {
        logger.warn(`[MetroSyncMiddleware] Manifest: could not stat ${fullPath}:`, e);
      }
    }
    logger.info(
      `[MetroSyncMiddleware] /mockifyer-sync-to-device-manifest: ${files.length} file(s), scenario "${currentScenario}"`
    );
    return { success: true, files, count: files.length };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * One mock file for GET /mockifyer-sync-to-device-file?path=
 */
function buildSyncToDeviceSingleFilePayload(mockDataPath: string, rawPathParam: string): {
  success: boolean;
  filename?: string;
  content?: MockData;
  modificationTime?: number;
  error?: string;
} {
  try {
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioPath(currentScenario, mockDataPath);
    const resolved = resolveScenarioRelativeMockPath(rawPathParam, scenarioPath);
    if (!resolved) {
      return { success: false, error: 'Invalid or unsafe path' };
    }
    const { fullPath, relativePath } = resolved;
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return { success: false, error: 'Not found' };
    }
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const content = JSON.parse(raw) as MockData;
    if (!content?.request || !content?.response) {
      return { success: false, error: 'Invalid mock JSON (missing request/response)' };
    }
    const stat = fs.statSync(fullPath);
    return {
      success: true,
      filename: relativePath,
      content,
      modificationTime: stat.mtimeMs,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Build payload for GET /mockifyer-sync-to-device (project mock-data → native app via HybridProvider).
 */
function buildSyncToDevicePayload(mockDataPath: string): {
  success: boolean;
  files?: Array<{ filename: string; content: MockData; modificationTime: number }>;
  count?: number;
  error?: string;
} {
  try {
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioPath(currentScenario, mockDataPath);
    const entries = listScenarioMockJsonFiles(scenarioPath);
    const files: Array<{ filename: string; content: MockData; modificationTime: number }> = [];

    for (const { relativePath, fullPath } of entries) {
      try {
        const raw = fs.readFileSync(fullPath, 'utf-8');
        const content = JSON.parse(raw) as MockData;
        if (!content?.request || !content?.response) {
          logger.debug(`[MetroSyncMiddleware] Skipping JSON without request/response: ${relativePath}`);
          continue;
        }
        const stat = fs.statSync(fullPath);
        files.push({
          filename: relativePath,
          content,
          modificationTime: stat.mtimeMs,
        });
      } catch (e) {
        logger.warn(`[MetroSyncMiddleware] Could not read ${fullPath}:`, e);
      }
    }

    logger.info(
      `[MetroSyncMiddleware] /mockifyer-sync-to-device: ${files.length} mock file(s) from scenario "${getCurrentScenario(mockDataPath)}"`
    );
    return { success: true, files, count: files.length };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Normalize URL pathname from Node/Metro `req.url` so `/mockifyer-sync-to-device/` matches `/mockifyer-sync-to-device`.
 * Without this, trailing slashes fall through to Expo Web's SPA and Expo Router treats them as AppDun routes.
 */
function normalizeMiddlewarePathname(reqUrl: string): string {
  if (!reqUrl || typeof reqUrl !== 'string') {
    return '/';
  }
  let pathname = reqUrl.split('?')[0];
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  return pathname;
}

/**
 * Metro middleware function
 */
export function createMockSyncMiddleware(options?: MetroSyncMiddlewareOptions) {
  const projectRoot = options?.projectRoot || process.cwd();
  const mockDataPath = path.resolve(projectRoot, options?.mockDataPath || 'mock-data');
  const testConfig = getTestGenerationConfig(options);
  
  // Log the resolved paths for debugging
  logger.info(`[MetroSyncMiddleware] Initialized with projectRoot: ${projectRoot}, mockDataPath: ${mockDataPath}`);

  return function mockSyncMiddleware(req: any, res: any, next: any) {
    const url = normalizeMiddlewarePathname(req.url || '');
    
    // Handle POST endpoint for clearing mocks
    if (url === '/mockifyer-clear' && req.method === 'POST') {
      const result = clearMockFiles(mockDataPath);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
      return;
    }
    
    // Handle POST endpoint for direct save (HybridProvider)
    if (url === '/mockifyer-save' && req.method === 'POST') {
      let body = '';
      
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          const mockData = JSON.parse(body);
          const result = saveMockToProjectFolder(mockData, projectRoot, mockDataPath, testConfig);
          
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: `Invalid JSON: ${(error as Error).message}`,
          }));
        }
      });
      return;
    }

    // Project folder → device/simulator: manifest (small JSON)
    if (url === '/mockifyer-sync-to-device-manifest' && req.method === 'GET') {
      const payload = buildSyncToDeviceManifest(mockDataPath);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = payload.success ? 200 : 500;
      res.end(JSON.stringify(payload));
      return;
    }

    // Single file for HybridProvider (avoids multi‑MB single response)
    if (url === '/mockifyer-sync-to-device-file' && req.method === 'GET') {
      const fullUrl = req.url || '';
      const qIndex = fullUrl.indexOf('?');
      const query = qIndex >= 0 ? fullUrl.slice(qIndex + 1) : '';
      const params = new URLSearchParams(query);
      const pathParam = params.get('path') || '';
      const payload = buildSyncToDeviceSingleFilePayload(mockDataPath, pathParam);
      res.setHeader('Content-Type', 'application/json');
      if (payload.success) {
        res.statusCode = 200;
      } else if (payload.error === 'Not found') {
        res.statusCode = 404;
      } else {
        res.statusCode = 400;
      }
      res.end(JSON.stringify(payload));
      return;
    }

    // Legacy: all files in one response (may OOM / timeout on large scenarios)
    if (url === '/mockifyer-sync-to-device' && req.method === 'GET') {
      const payload = buildSyncToDevicePayload(mockDataPath);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = payload.success ? 200 : 500;
      res.end(JSON.stringify(payload));
      return;
    }
    
    // Handle GET endpoint for sync status
    if (url === '/mockifyer-sync/status' && req.method === 'GET') {
      const currentScenario = getCurrentScenario(mockDataPath);
      const scenarioPath = getScenarioPath(currentScenario, mockDataPath);
      const files = fs.existsSync(scenarioPath) 
        ? fs.readdirSync(scenarioPath).filter((f: string) => f.endsWith('.json'))
        : [];
      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        scenario: currentScenario,
        fileCount: files.length,
        files: files.slice(0, 10), // Return first 10 files
      }));
      return;
    }
    
    // Handle GET endpoint for sync (legacy polling-based sync)
    if (url === '/mockifyer-sync' && req.method === 'GET') {
      const result = syncFromIOSSimulator(projectRoot, mockDataPath);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
      return;
    }
    
    // Handle GET endpoint for scenario config
    if (url === '/mockifyer-scenario-config' && req.method === 'GET') {
      try {
        // Check environment variable first (highest priority)
        if (process.env.MOCKIFYER_SCENARIO) {
          logger.info(`[MetroSyncMiddleware] Using scenario from MOCKIFYER_SCENARIO env var: ${process.env.MOCKIFYER_SCENARIO}`);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ 
            success: true, 
            currentScenario: process.env.MOCKIFYER_SCENARIO 
          }));
          return;
        }
        
        const configPath = path.join(mockDataPath, 'scenario-config.json');
        const resolvedPath = path.resolve(configPath);
        logger.info(`[MetroSyncMiddleware] Reading scenario config from: ${resolvedPath}`);
        logger.info(`[MetroSyncMiddleware] mockDataPath: ${mockDataPath}, projectRoot: ${projectRoot}`);
        
        if (fs.existsSync(configPath)) {
          const fileContent = fs.readFileSync(configPath, 'utf-8');
          logger.info(`[MetroSyncMiddleware] File content: ${fileContent}`);
          const config = JSON.parse(fileContent);
          const scenario = config.currentScenario || DEFAULT_SCENARIO;
          logger.info(`[MetroSyncMiddleware] Found scenario in config: ${scenario} (from file: ${JSON.stringify(config)})`);
          
          res.setHeader('Content-Type', 'application/json');
          // Return format expected by ExpoFileSystemProvider: { success: true, currentScenario: ... }
          res.end(JSON.stringify({ 
            success: true, 
            currentScenario: scenario 
          }));
        } else {
          logger.info(`[MetroSyncMiddleware] Config file not found at ${resolvedPath}, returning default scenario`);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ 
            success: true, 
            currentScenario: DEFAULT_SCENARIO 
          }));
        }
      } catch (error) {
        logger.error(`[MetroSyncMiddleware] Error reading scenario config:`, error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      }
      return;
    }
    
    // Handle POST endpoint for scenario config sync
    if (url === '/mockifyer-scenario-config' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const config = JSON.parse(body);
          const configPath = path.join(mockDataPath, 'scenario-config.json');
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: (error as Error).message }));
        }
      });
      return;
    }
    
    // Continue to next middleware if not handled
    next();
  };
}

/**
 * Start auto-sync from iOS Simulator
 */
export function startAutoSync(
  intervalMs: number = 5000,
  options?: MetroSyncMiddlewareOptions
): void {
  if (autoSyncInterval) {
    return;
  }

  const projectRoot = options?.projectRoot || process.cwd();
  const mockDataPath = path.resolve(projectRoot, options?.mockDataPath || 'mock-data');

  logger.info(`[MockSync] Starting auto-sync every ${intervalMs}ms`);
  autoSyncInterval = setInterval(() => {
    syncFromIOSSimulator(projectRoot, mockDataPath);
  }, intervalMs);
}

/**
 * Stop auto-sync
 */
export function stopAutoSync(): void {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
}

// Export sync function for manual use
export { syncFromIOSSimulator };

