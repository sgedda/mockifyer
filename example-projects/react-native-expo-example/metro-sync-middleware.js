/**
 * Metro middleware for mock file synchronization
 * 
 * Provides two sync mechanisms:
 * 1. POST /mockifyer-save - Direct save endpoint (used by Hybrid Provider for instant sync)
 * 2. GET /mockifyer-sync - Legacy polling-based sync endpoint (for manual sync)
 * 
 * The Hybrid Provider (recommended) uses POST /mockifyer-save for instant file sync.
 * Legacy polling-based sync is still available for backward compatibility.
 * 
 * Usage: Add to metro.config.js middleware array
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = __dirname;
const MOCK_DATA_PATH = path.join(PROJECT_ROOT, 'mock-data');
const DEFAULT_SCENARIO = 'default';

/**
 * Get current scenario from scenario-config.json
 */
function getCurrentScenario() {
  // Check environment variable first
  if (process.env.MOCKIFYER_SCENARIO) {
    return process.env.MOCKIFYER_SCENARIO;
  }

  // Try to load from scenario-config.json
  try {
    const configPath = path.join(MOCK_DATA_PATH, 'scenario-config.json');
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
function getScenarioPath(scenario) {
  return path.join(MOCK_DATA_PATH, scenario || getCurrentScenario());
}

// Track last sync time to avoid duplicate syncs
let lastSyncTime = Date.now();
let syncInProgress = false;

/**
 * Sync mock files from iOS Simulator to project folder
 */
async function syncFromIOSSimulator() {
  if (process.platform !== 'darwin') {
    return { success: false, filesSynced: 0, error: 'iOS sync only works on macOS' };
  }

  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      return { success: false, filesSynced: 0, error: 'Cannot find home directory' };
    }

    // Find booted simulator
    let deviceId;
    try {
      const bootedOutput = execSync('xcrun simctl list devices booted', { encoding: 'utf-8' });
      const deviceMatch = bootedOutput.match(/\(([A-F0-9-]+)\)/);
      if (!deviceMatch) {
        return { success: false, filesSynced: 0, error: 'No booted iOS simulator found' };
      }
      deviceId = deviceMatch[1];
    } catch (error) {
      return { success: false, filesSynced: 0, error: 'Failed to find simulator' };
    }

    const simulatorDataPath = path.join(
      homeDir,
      'Library/Developer/CoreSimulator/Devices',
      deviceId,
      'data/Containers/Data/Application'
    );

    if (!fs.existsSync(simulatorDataPath)) {
      return { success: false, filesSynced: 0, error: 'Simulator data path not found' };
    }

    // Find app directory containing mock-data
    const appDirs = fs.readdirSync(simulatorDataPath);
    let found = false;
    let filesSynced = 0;
    const syncedFiles = [];

    // Get current scenario
    const currentScenario = getCurrentScenario();
    const scenarioPath = getScenarioPath(currentScenario);
    
    for (const appDir of appDirs) {
      // Check for scenario folder in simulator
      const documentsPath = path.join(simulatorDataPath, appDir, 'Documents', 'mock-data', currentScenario);
      
      if (fs.existsSync(documentsPath)) {
        // Ensure project scenario directory exists
        fs.mkdirSync(scenarioPath, { recursive: true });
        
        // Get list of files in simulator scenario folder
        const simulatorFiles = fs.readdirSync(documentsPath).filter(f => f.endsWith('.json'));
        
        // Get list of files in project scenario folder (to check if sync needed)
        const projectFiles = fs.existsSync(scenarioPath) 
          ? fs.readdirSync(scenarioPath).filter(f => f.endsWith('.json'))
          : [];
        
        // Sync files that are new or modified
        for (const file of simulatorFiles) {
          const src = path.join(documentsPath, file);
          const dest = path.join(scenarioPath, file);
          
          let shouldSync = false;
          if (!fs.existsSync(dest)) {
            shouldSync = true; // New file
          } else {
            // Check if simulator file is newer
            const srcStats = fs.statSync(src);
            const destStats = fs.statSync(dest);
            if (srcStats.mtime > destStats.mtime) {
              shouldSync = true; // Modified file
            }
          }
          
          if (shouldSync) {
            fs.copyFileSync(src, dest);
            syncedFiles.push(file);
            filesSynced++;
          }
        }
        
        found = true;
        break;
      }
    }

    if (!found) {
      return { success: false, filesSynced: 0, error: 'mock-data directory not found in simulator' };
    }

    return { success: true, filesSynced, syncedFiles };
  } catch (error) {
    return { success: false, filesSynced: 0, error: error.message };
  }
}

/**
 * Save mock data directly to project folder
 * Called by HybridProvider when saving mocks
 */
function saveMockToProjectFolder(mockData) {
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
      console.warn(`[MockSync] ⚠️ Rejecting save - Mock data contains nested Mockifyer sync requests`);
      return { success: false, error: 'Mock data contains nested Mockifyer sync requests' };
    }
    
    // Get current scenario and ensure scenario folder exists
    const currentScenario = getCurrentScenario();
    const scenarioPath = getScenarioPath(currentScenario);
    fs.mkdirSync(scenarioPath, { recursive: true });

    // Format the datetime to be readable
    const now = new Date();
    const dateStr = now.toISOString()
      .replace(/T/, '_')
      .replace(/\..+/, '')
      .replace(/:/g, '-');

    // Create a safe filename from the URL
    const urlSafe = mockData.request.url
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]/g, '_');

    const filename = `${dateStr}_${mockData.request.method}_${urlSafe}.json`;
    const filePath = path.join(scenarioPath, filename);

    // Check if file already exists - skip saving if it does
    if (fs.existsSync(filePath)) {
      console.log(`[MockSync] ⚠️ File already exists, skipping save: ${filename}`);
      return { success: true, filename, skipped: true, reason: 'File already exists' };
    }

    // Write to file
    fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
    
    console.log(`[MockSync] ✅ Saved mock to project folder: ${currentScenario}/${filename}`);
    return { success: true, filename, scenario: currentScenario };
  } catch (error) {
    console.error(`[MockSync] ❌ Error saving mock to project folder:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Clear all mock files from project folder (current scenario)
 */
function clearMockFiles() {
  try {
    const currentScenario = getCurrentScenario();
    const scenarioPath = getScenarioPath(currentScenario);
    
    if (!fs.existsSync(scenarioPath)) {
      return { success: true, filesDeleted: 0, message: `Scenario directory does not exist: ${currentScenario}` };
    }

    const files = fs.readdirSync(scenarioPath).filter(f => f.endsWith('.json'));
    let filesDeleted = 0;

    for (const file of files) {
      const filePath = path.join(scenarioPath, file);
      try {
        fs.unlinkSync(filePath);
        filesDeleted++;
        console.log(`[MockSync] ✅ Deleted: ${file}`);
      } catch (error) {
        console.warn(`[MockSync] Failed to delete ${file}:`, error);
      }
    }

    console.log(`[MockSync] ✅ Cleared ${filesDeleted} mock file(s) from project folder`);
    return { success: true, filesDeleted };
  } catch (error) {
    console.error(`[MockSync] ❌ Error clearing mock files:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Sync scenario-config.json from project folder to device
 */
function syncScenarioConfig(deviceDocumentsPath) {
  try {
    const projectConfigPath = path.join(MOCK_DATA_PATH, 'scenario-config.json');
    const deviceConfigPath = path.join(deviceDocumentsPath, 'scenario-config.json');
    
    if (fs.existsSync(projectConfigPath)) {
      // Copy scenario-config.json to device
      fs.mkdirSync(deviceDocumentsPath, { recursive: true });
      fs.copyFileSync(projectConfigPath, deviceConfigPath);
      console.log(`[MockSync] ✅ Synced scenario-config.json to device`);
      return { success: true };
    }
    return { success: false, message: 'scenario-config.json not found in project folder' };
  } catch (error) {
    console.error(`[MockSync] ❌ Error syncing scenario-config.json:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Metro middleware function - provides REST API for mock sync
 * 
 * Endpoints:
 *   POST /mockifyer-save - Save mock data directly to project folder (used by HybridProvider)
 *   POST /mockifyer-clear - Clear all mock files from project folder
 *   GET /mockifyer-sync - Trigger sync and return result (legacy polling-based sync)
 *   GET /mockifyer-sync/status - Get sync status
 *   GET /mockifyer-scenario-config - Get scenario config from project folder
 *   POST /mockifyer-scenario-config - Sync scenario config to device
 */
function mockSyncMiddleware(req, res, next) {
  const url = req.url.split('?')[0]; // Remove query params
  
  // Handle POST endpoint for clearing mocks
  if (url === '/mockifyer-clear' && req.method === 'POST') {
    const result = clearMockFiles();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
    return;
  }
  
  // Handle POST endpoint for direct save (HybridProvider)
  if (url === '/mockifyer-save' && req.method === 'POST') {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const mockData = JSON.parse(body);
        const result = saveMockToProjectFolder(mockData);
        
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          error: `Invalid JSON: ${error.message}`,
        }));
      }
    });
    
    // Don't call next() - we're handling the response asynchronously
    return;
  }
  
  // Handle sync-to-device endpoint - returns mock files from project folder for app to save
  if (url === '/mockifyer-sync-to-device' && req.method === 'GET') {
    try {
      // Ensure directory exists
      if (!fs.existsSync(MOCK_DATA_PATH)) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          files: [],
          error: 'Mock data directory not found',
        }));
        return;
      }

      // Read all JSON files from project scenario folder
      const currentScenario = getCurrentScenario();
      const scenarioPath = getScenarioPath(currentScenario);
      
      if (!fs.existsSync(scenarioPath)) {
        return res.json({ files: [], scenario: currentScenario });
      }
      
      const files = fs.readdirSync(scenarioPath).filter(f => f.endsWith('.json'));
      const fileData = [];

      for (const file of files) {
        try {
          const filePath = path.join(scenarioPath, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const mockData = JSON.parse(content);
          const stats = fs.statSync(filePath);
          
          fileData.push({
            filename: file,
            content: mockData,
            modificationTime: stats.mtime.getTime(),
          });
        } catch (error) {
          console.warn(`[MockSync] ⚠️ Failed to read file ${file}:`, error.message);
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        files: fileData,
        count: fileData.length,
        scenario: currentScenario,
      }));
      
      console.log(`[MockSync] 📤 Sent ${fileData.length} mock file(s) to device for sync`);
      return;
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        files: [],
        error: error.message,
      }));
      return;
    }
  }

  // Handle reload endpoint - signals app to reload mock files
  if (url === '/mockifyer-reload' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: true,
      message: 'Reload signal sent',
      timestamp: new Date().toISOString(),
    }));
    console.log('[MockSync] 🔄 Reload signal sent to app');
    return;
  }

  // Handle scenario config endpoints
  if (url === '/mockifyer-scenario-config' && req.method === 'GET') {
    try {
      const configPath = path.join(MOCK_DATA_PATH, 'scenario-config.json');
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(fileContent);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          currentScenario: config.currentScenario || DEFAULT_SCENARIO,
        }));
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          currentScenario: DEFAULT_SCENARIO,
        }));
      }
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: error.message,
      }));
    }
    return;
  }

  if (url === '/mockifyer-scenario-config' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { scenario } = JSON.parse(body);
        const currentScenario = scenario || DEFAULT_SCENARIO;
        const configPath = path.join(MOCK_DATA_PATH, 'scenario-config.json');
        const config = {
          currentScenario,
          updatedAt: new Date().toISOString()
        };
        fs.mkdirSync(MOCK_DATA_PATH, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          currentScenario,
        }));
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          error: error.message,
        }));
      }
    });
    return;
  }

  // Handle sync status endpoint
  if (url === '/mockifyer-sync/status') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      autoSyncEnabled: autoSyncInterval !== null,
      syncInProgress: syncInProgress,
      lastSyncTime: lastSyncTime,
      projectMockDataPath: MOCK_DATA_PATH,
    }));
    return;
  }
  
  // Handle sync trigger endpoint (legacy polling-based sync)
  if (url === '/mockifyer-sync') {
    // Prevent concurrent syncs
    if (syncInProgress) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        success: false, 
        message: 'Sync already in progress',
        filesSynced: 0 
      }));
      return;
    }

    syncInProgress = true;

    // Perform sync (async)
    syncFromIOSSimulator().then((result) => {
      syncInProgress = false;
      lastSyncTime = Date.now();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        ...result,
        timestamp: new Date().toISOString(),
      }));
    }).catch((error) => {
      syncInProgress = false;
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        success: false, 
        filesSynced: 0, 
        error: error.message,
        timestamp: new Date().toISOString(),
      }));
    });
    
    // Don't call next() - we're handling the response asynchronously
    return;
  }
  
  // Not a sync endpoint, continue to next middleware
  return next();
}

/**
 * Auto-sync on interval (optional - can be enabled)
 */
let autoSyncInterval = null;

function startAutoSync(intervalMs = 5000) {
  if (autoSyncInterval) {
    return; // Already running
  }

  autoSyncInterval = setInterval(async () => {
    if (syncInProgress) {
      return;
    }

    try {
      const result = await syncFromIOSSimulator();
      if (result.success && result.filesSynced > 0) {
        console.log(`[MockSync] Auto-synced ${result.filesSynced} file(s):`, result.syncedFiles.join(', '));
      }
    } catch (error) {
      // Silent fail for auto-sync
    }
  }, intervalMs);

  console.log(`[MockSync] Auto-sync enabled (every ${intervalMs}ms)`);
}

function stopAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
    console.log('[MockSync] Auto-sync disabled');
  }
}

module.exports = {
  middleware: mockSyncMiddleware, // The middleware function
  startAutoSync,
  stopAutoSync,
  syncFromIOSSimulator,
};

