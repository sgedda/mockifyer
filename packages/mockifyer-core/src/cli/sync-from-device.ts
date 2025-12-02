#!/usr/bin/env ts-node

/**
 * Sync mock files from React Native device/simulator to project folder
 * 
 * This script syncs mock files created on the device back to the project's
 * mock-data folder so they can be version controlled and viewed in the dashboard.
 * 
 * Usage:
 *   mockifyer sync-from-device [options]
 *   or: npx @sgedda/mockifyer-core sync-from-device [options]
 * 
 * Options:
 *   --path <path>    Path to mock data directory (default: ./mock-data)
 *   --ios            Try iOS Simulator first (default on macOS)
 *   --android        Try Android Emulator first
 *   --http            Try HTTP endpoint (requires app to expose endpoint)
 *   --package <name> Android package name (auto-detected from app.json if available)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface SyncResult {
  success: boolean;
  method: string;
  filesSynced: number;
  error?: string;
}

interface CliOptions {
  path?: string;
  ios?: boolean;
  android?: boolean;
  http?: boolean;
  package?: string;
  help?: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--path' || args[i] === '-p') {
      options.path = args[++i];
    } else if (args[i] === '--ios') {
      options.ios = true;
    } else if (args[i] === '--android') {
      options.android = true;
    } else if (args[i] === '--http') {
      options.http = true;
    } else if (args[i] === '--package') {
      options.package = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      options.help = true;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Mockifyer Sync from Device

Sync mock files from React Native device/simulator to project folder.

Usage:
  mockifyer sync-from-device [options]

Options:
  -p, --path <path>      Path to mock data directory (default: ./mock-data)
  --ios                  Try iOS Simulator first (default on macOS)
  --android              Try Android Emulator first
  --http                 Try HTTP endpoint (requires app to expose endpoint)
  --package <name>       Android package name (auto-detected from app.json)
  -h, --help             Show this help message

Examples:
  # Auto-detect device
  mockifyer sync-from-device

  # Explicit platform
  mockifyer sync-from-device --ios
  mockifyer sync-from-device --android

  # HTTP endpoint
  mockifyer sync-from-device --http

  # Custom path
  mockifyer sync-from-device --path ./mocks
`);
}

/**
 * Sync from iOS Simulator
 */
async function syncFromIOSSimulator(mockDataPath: string): Promise<SyncResult> {
  if (process.platform !== 'darwin') {
    return { success: false, method: 'ios', filesSynced: 0, error: 'iOS sync only works on macOS' };
  }

  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      return { success: false, method: 'ios', filesSynced: 0, error: 'Cannot find home directory' };
    }

    // Find booted simulator
    const bootedOutput = execSync('xcrun simctl list devices booted', { encoding: 'utf-8' });
    const deviceMatch = bootedOutput.match(/\(([A-F0-9-]+)\)/);
    
    if (!deviceMatch) {
      return { success: false, method: 'ios', filesSynced: 0, error: 'No booted iOS simulator found' };
    }

    const deviceId = deviceMatch[1];
    const simulatorDataPath = path.join(
      homeDir,
      'Library/Developer/CoreSimulator/Devices',
      deviceId,
      'data/Containers/Data/Application'
    );

    if (!fs.existsSync(simulatorDataPath)) {
      return { success: false, method: 'ios', filesSynced: 0, error: 'Simulator data path not found' };
    }

    // Find app directory containing mock-data
    const appDirs = fs.readdirSync(simulatorDataPath);
    let found = false;
    let filesSynced = 0;

    for (const appDir of appDirs) {
      const deviceMockDataPath = path.join(simulatorDataPath, appDir, 'Documents', 'mock-data');
      
      if (fs.existsSync(deviceMockDataPath)) {
        console.log(`[Sync] Found mock-data in simulator: ${deviceMockDataPath}`);
        
        // Ensure project mock-data directory exists
        fs.mkdirSync(mockDataPath, { recursive: true });
        
        // Copy files from device to project
        const files = fs.readdirSync(deviceMockDataPath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const src = path.join(deviceMockDataPath, file);
            const dest = path.join(mockDataPath, file);
            fs.copyFileSync(src, dest);
            console.log(`  ✓ Synced: ${file}`);
            filesSynced++;
          }
        }
        
        found = true;
        break;
      }
    }

    if (!found) {
      return { success: false, method: 'ios', filesSynced: 0, error: 'mock-data directory not found in simulator' };
    }

    return { success: true, method: 'ios', filesSynced };
  } catch (error: any) {
    return { success: false, method: 'ios', filesSynced: 0, error: error.message };
  }
}

/**
 * Sync from Android Emulator
 */
async function syncFromAndroid(mockDataPath: string, packageName?: string, projectRoot?: string): Promise<SyncResult> {
  try {
    // Check if adb is available
    execSync('adb version', { stdio: 'ignore' });
  } catch {
    return { success: false, method: 'android', filesSynced: 0, error: 'adb not found' };
  }

  try {
    // Get package name
    let finalPackageName = packageName || 'com.yourcompany.yourapp';
    
    if (!packageName && projectRoot) {
      const appJsonPath = path.join(projectRoot, 'app.json');
      if (fs.existsSync(appJsonPath)) {
        const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
        finalPackageName = appJson.expo?.android?.package || finalPackageName;
      }
    }

    const devicePath = `/data/data/${finalPackageName}/files/mock-data`;
    const tempPath = path.join(projectRoot || process.cwd(), 'temp-mocks');

    // Pull files from device
    try {
      execSync(`adb pull ${devicePath} ${tempPath}`, { stdio: 'pipe' });
    } catch (error: any) {
      if (error.message.includes('does not exist') || error.message.includes('No such file')) {
        return { success: false, method: 'android', filesSynced: 0, error: 'mock-data directory not found on device' };
      }
      throw error;
    }

    if (!fs.existsSync(tempPath)) {
      return { success: false, method: 'android', filesSynced: 0, error: 'Failed to pull files from device' };
    }

    // Copy to project folder
    fs.mkdirSync(mockDataPath, { recursive: true });
    const files = fs.readdirSync(tempPath);
    let filesSynced = 0;

    for (const file of files) {
      if (file.endsWith('.json')) {
        fs.copyFileSync(
          path.join(tempPath, file),
          path.join(mockDataPath, file)
        );
        console.log(`  ✓ Synced: ${file}`);
        filesSynced++;
      }
    }

    // Cleanup temp directory
    try {
      fs.rmSync(tempPath, { recursive: true });
    } catch (error: any) {
      // Ignore cleanup errors
      console.warn(`[Sync] Warning: Could not clean up temp directory: ${tempPath}`);
    }

    return { success: true, method: 'android', filesSynced };
  } catch (error: any) {
    return { success: false, method: 'android', filesSynced: 0, error: error.message };
  }
}

/**
 * Sync via HTTP endpoint (requires app to expose endpoint)
 */
async function syncFromHTTP(mockDataPath: string, port: number = 8080): Promise<SyncResult> {
  try {
    // Try to use node-fetch if available, otherwise use global fetch (Node 18+)
    let fetchFn: any;
    try {
      // Dynamic import with type assertion to avoid TypeScript error if node-fetch is not installed
      const nodeFetch = await import('node-fetch' as any);
      fetchFn = (nodeFetch.default || nodeFetch) as any;
    } catch {
      // Use global fetch if available (Node 18+)
      if (typeof fetch === 'undefined') {
        return { success: false, method: 'http', filesSynced: 0, error: 'fetch not available. Install node-fetch or use Node 18+' };
      }
      fetchFn = fetch;
    }
    
    const response = await fetchFn(`http://localhost:${port}/mocks`);
    
    if (!response.ok) {
      return { success: false, method: 'http', filesSynced: 0, error: `HTTP ${response.status}` };
    }

    const mocks = await response.json();
    
    if (!Array.isArray(mocks)) {
      return { success: false, method: 'http', filesSynced: 0, error: 'Invalid response format' };
    }

    fs.mkdirSync(mockDataPath, { recursive: true });
    let filesSynced = 0;

    for (const mock of mocks) {
      if (mock.filename && mock.content) {
        const filePath = path.join(mockDataPath, mock.filename);
        fs.writeFileSync(filePath, JSON.stringify(mock.content, null, 2));
        console.log(`  ✓ Synced: ${mock.filename}`);
        filesSynced++;
      }
    }

    return { success: true, method: 'http', filesSynced };
  } catch (error: any) {
    return { success: false, method: 'http', filesSynced: 0, error: error.message };
  }
}

/**
 * Main sync function
 */
async function syncFromDevice(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Detect mock data path
  const mockDataPath = options.path 
    ? (path.isAbsolute(options.path) ? options.path : path.join(process.cwd(), options.path))
    : path.join(process.cwd(), 'mock-data');

  console.log('🔄 Syncing mock files from device to project folder...\n');
  console.log(`📁 Destination: ${mockDataPath}\n`);

  const preferIOS = options.ios || (!options.android && !options.http && process.platform === 'darwin');
  const preferAndroid = options.android;
  const preferHTTP = options.http;
  const projectRoot = process.cwd();

  let result: SyncResult | null = null;

  // Try methods in order of preference
  if (preferHTTP) {
    console.log('Trying HTTP endpoint...');
    result = await syncFromHTTP(mockDataPath);
  } else if (preferAndroid) {
    console.log('Trying Android Emulator...');
    result = await syncFromAndroid(mockDataPath, options.package, projectRoot);
    if (!result.success && process.platform === 'darwin') {
      console.log('Trying iOS Simulator...');
      result = await syncFromIOSSimulator(mockDataPath);
    }
  } else if (preferIOS || process.platform === 'darwin') {
    console.log('Trying iOS Simulator...');
    result = await syncFromIOSSimulator(mockDataPath);
    if (!result.success) {
      console.log('Trying Android Emulator...');
      result = await syncFromAndroid(mockDataPath, options.package, projectRoot);
    }
  } else {
    console.log('Trying Android Emulator...');
    result = await syncFromAndroid(mockDataPath, options.package, projectRoot);
  }

  // Try HTTP as fallback if not explicitly requested
  if ((!result || !result.success) && !preferHTTP) {
    console.log('Trying HTTP endpoint...');
    const httpResult = await syncFromHTTP(mockDataPath);
    if (httpResult.success) {
      result = httpResult;
    }
  }

  // Report results
  console.log('');
  if (result && result.success) {
    console.log(`✅ Successfully synced ${result.filesSynced} file(s) using ${result.method}`);
    console.log(`📁 Files saved to: ${mockDataPath}`);
  } else {
    console.log('❌ Failed to sync mock files from device');
    if (result) {
      console.log(`   Method: ${result.method}`);
      console.log(`   Error: ${result.error || 'Unknown error'}`);
    }
    console.log('\n💡 Tips:');
    console.log('   - Make sure your app is running in development mode');
    console.log('   - For iOS: Ensure simulator is booted');
    console.log('   - For Android: Ensure emulator is running and adb is connected');
    console.log('   - Try: mockifyer sync-from-device --ios (for iOS)');
    console.log('   - Try: mockifyer sync-from-device --android (for Android)');
    process.exit(1);
  }
}

// Run sync if called directly
if (require.main === module) {
  syncFromDevice().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for programmatic use
export { syncFromDevice, syncFromIOSSimulator, syncFromAndroid, syncFromHTTP };

