#!/usr/bin/env ts-node

/**
 * Sync mock files from project folder to React Native device/simulator
 * 
 * This script syncs mock files from the project's mock-data folder back to
 * the device/simulator so they can be used by the app.
 * 
 * Usage:
 *   mockifyer sync-to-device [options]
 *   or: npx @sgedda/mockifyer-core sync-to-device [options]
 * 
 * Options:
 *   --path <path>    Path to mock data directory (default: ./mock-data)
 *   --ios            Try iOS Simulator first (default on macOS)
 *   --android        Try Android Emulator first
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
Mockifyer Sync to Device

Sync mock files from project folder to React Native device/simulator.

Usage:
  mockifyer sync-to-device [options]

Options:
  -p, --path <path>      Path to mock data directory (default: ./mock-data)
  --ios                  Try iOS Simulator first (default on macOS)
  --android              Try Android Emulator first
  --package <name>       Android package name (auto-detected from app.json)
  -h, --help             Show this help message

Examples:
  # Auto-detect device
  mockifyer sync-to-device

  # Explicit platform
  mockifyer sync-to-device --ios
  mockifyer sync-to-device --android

  # Custom path
  mockifyer sync-to-device --path ./mocks

  # Android with package name
  mockifyer sync-to-device --android --package com.myapp
`);
}

/**
 * Sync to iOS Simulator
 */
async function syncToIOSSimulator(mockDataPath: string): Promise<SyncResult> {
  if (process.platform !== 'darwin') {
    return { success: false, method: 'ios', filesSynced: 0, error: 'iOS sync only works on macOS' };
  }

  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      return { success: false, method: 'ios', filesSynced: 0, error: 'Cannot find home directory' };
    }

    // Check if source directory exists
    if (!fs.existsSync(mockDataPath)) {
      return { success: false, method: 'ios', filesSynced: 0, error: `Source directory not found: ${mockDataPath}` };
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

    // Find app directory containing Documents
    const appDirs = fs.readdirSync(simulatorDataPath);
    let found = false;
    let filesSynced = 0;

    for (const appDir of appDirs) {
      const documentsPath = path.join(simulatorDataPath, appDir, 'Documents');
      
      if (fs.existsSync(documentsPath)) {
        const deviceMockDataPath = path.join(documentsPath, 'mock-data');
        
        // Create mock-data directory if it doesn't exist
        if (!fs.existsSync(deviceMockDataPath)) {
          fs.mkdirSync(deviceMockDataPath, { recursive: true });
          console.log(`[Sync] Created mock-data directory: ${deviceMockDataPath}`);
        }
        
        console.log(`[Sync] Found Documents directory in simulator: ${documentsPath}`);
        
        // Copy files from project to device
        const files = fs.readdirSync(mockDataPath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const src = path.join(mockDataPath, file);
            const dest = path.join(deviceMockDataPath, file);
            
            // Read source file stats to preserve modification time
            const srcStats = fs.statSync(src);
            
            // Copy file
            fs.copyFileSync(src, dest);
            
            // Preserve modification time (if supported)
            try {
              fs.utimesSync(dest, srcStats.atime, srcStats.mtime);
            } catch (error) {
              // Some file systems don't support utimes, ignore
            }
            
            console.log(`  ✓ Synced: ${file} (mtime: ${new Date(srcStats.mtime).toISOString()})`);
            filesSynced++;
          }
        }
        
        found = true;
        break;
      }
    }

    if (!found) {
      return { success: false, method: 'ios', filesSynced: 0, error: 'Documents directory not found in simulator' };
    }

    return { success: true, method: 'ios', filesSynced };
  } catch (error: any) {
    return { success: false, method: 'ios', filesSynced: 0, error: error.message };
  }
}

/**
 * Sync to Android Emulator
 */
async function syncToAndroid(mockDataPath: string, packageName?: string, projectRoot?: string): Promise<SyncResult> {
  try {
    // Check if adb is available
    execSync('adb version', { stdio: 'ignore' });
  } catch {
    return { success: false, method: 'android', filesSynced: 0, error: 'adb not found' };
  }

  try {
    // Check if source directory exists
    if (!fs.existsSync(mockDataPath)) {
      return { success: false, method: 'android', filesSynced: 0, error: `Source directory not found: ${mockDataPath}` };
    }

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

    // Create directory on device if it doesn't exist
    try {
      execSync(`adb shell mkdir -p ${devicePath}`, { stdio: 'pipe' });
    } catch (error: any) {
      // Directory might already exist, that's fine
    }

    // Push files to device
    const files = fs.readdirSync(mockDataPath).filter(f => f.endsWith('.json'));
    let filesSynced = 0;

    for (const file of files) {
      const src = path.join(mockDataPath, file);
      const dest = `${devicePath}/${file}`;
      
      try {
        execSync(`adb push "${src}" "${dest}"`, { stdio: 'pipe' });
        console.log(`  ✓ Synced: ${file}`);
        filesSynced++;
      } catch (error: any) {
        console.warn(`  ⚠️ Failed to sync ${file}: ${error.message}`);
      }
    }

    if (filesSynced === 0) {
      return { success: false, method: 'android', filesSynced: 0, error: 'No files were synced' };
    }

    return { success: true, method: 'android', filesSynced };
  } catch (error: any) {
    return { success: false, method: 'android', filesSynced: 0, error: error.message };
  }
}

/**
 * Main sync function
 */
async function syncToDevice(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Detect mock data path
  const mockDataPath = options.path 
    ? (path.isAbsolute(options.path) ? options.path : path.join(process.cwd(), options.path))
    : path.join(process.cwd(), 'mock-data');

  console.log('🔄 Syncing mock files from project folder to device...\n');
  console.log(`📁 Source: ${mockDataPath}\n`);

  // Check if source directory exists
  if (!fs.existsSync(mockDataPath)) {
    console.log(`❌ Source directory not found: ${mockDataPath}`);
    console.log('\n💡 Tips:');
    console.log('   - Make sure you have mock files in ./mock-data/');
    console.log('   - Run the app first to generate some mocks');
    console.log('   - Or copy mock files manually to ./mock-data/');
    console.log('   - Use --path to specify a custom path');
    process.exit(1);
  }

  const files = fs.readdirSync(mockDataPath).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log(`⚠️  No JSON files found in ${mockDataPath}`);
    console.log('\n💡 Tips:');
    console.log('   - Make sure you have mock files in the directory');
    console.log('   - Run the app first to generate some mocks');
    process.exit(1);
  }

  console.log(`Found ${files.length} mock file(s) to sync\n`);

  const preferIOS = options.ios || (!options.android && process.platform === 'darwin');
  const preferAndroid = options.android;
  const projectRoot = process.cwd();

  let result: SyncResult | null = null;

  // Try methods in order of preference
  if (preferAndroid) {
    console.log('Trying Android Emulator...');
    result = await syncToAndroid(mockDataPath, options.package, projectRoot);
    if (!result.success && process.platform === 'darwin') {
      console.log('Trying iOS Simulator...');
      result = await syncToIOSSimulator(mockDataPath);
    }
  } else if (preferIOS || process.platform === 'darwin') {
    console.log('Trying iOS Simulator...');
    result = await syncToIOSSimulator(mockDataPath);
    if (!result.success) {
      console.log('Trying Android Emulator...');
      result = await syncToAndroid(mockDataPath, options.package, projectRoot);
    }
  } else {
    console.log('Trying Android Emulator...');
    result = await syncToAndroid(mockDataPath, options.package, projectRoot);
  }

  // Report results
  console.log('');
  if (result && result.success) {
    console.log(`✅ Successfully synced ${result.filesSynced} file(s) to device using ${result.method}`);
    console.log(`📱 Files are now available on the device`);
    console.log(`\n💡 Tip: Restart your app to load the synced mock files`);
  } else {
    console.log('❌ Failed to sync mock files to device');
    if (result) {
      console.log(`   Method: ${result.method}`);
      console.log(`   Error: ${result.error || 'Unknown error'}`);
    }
    console.log('\n💡 Tips:');
    console.log('   - Make sure your app is running in development mode');
    console.log('   - For iOS: Ensure simulator is booted');
    console.log('   - For Android: Ensure emulator is running and adb is connected');
    console.log('   - Try: mockifyer sync-to-device --ios (for iOS)');
    console.log('   - Try: mockifyer sync-to-device --android (for Android)');
    process.exit(1);
  }
}

// Run sync if called directly
if (require.main === module) {
  syncToDevice().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for programmatic use
export { syncToDevice, syncToIOSSimulator, syncToAndroid };


