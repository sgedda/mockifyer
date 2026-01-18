/**
 * Simplified Mockifyer Setup for React Native Expo
 * 
 * This is the SIMPLIFIED version using the helper function from the package.
 * Compare with mockifyer-setup.ts to see the difference.
 * 
 * Usage:
 *   import { initializeMockifyer } from './mockifyer-setup-simple';
 *   await initializeMockifyer();
 */

import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch';

/**
 * Initialize Mockifyer - automatically handles dev/prod provider selection
 * 
 * Development: Uses Expo FileSystem provider (can record mocks)
 * Production: Uses Memory provider with bundled TypeScript file
 */
export async function initializeMockifyer() {
  // In React Native/Expo, process.env is not available at runtime
  // Environment variables set in shell aren't accessible in the bundle
  // 
  // To enable recording, you have two options:
  // 
  // Option 1: Enable recording in development (simple - change true to false to disable)
  const recordMode = __DEV__ && true; // Set to true to enable recording in dev mode
  
  // Option 2: Use expo-constants with .env file (requires additional setup)
  // Uncomment below if you have expo-constants and .env configured:
  // import Constants from 'expo-constants';
  // const recordMode = Constants.expoConfig?.extra?.MOCKIFYER_RECORD === 'true' || (__DEV__ && true);
  
  return await setupMockifyerForReactNative({
    isDev: __DEV__, // Pass React Native's __DEV__ variable
    mockDataPath: 'mock-data',
    bundledDataPath: './assets/mock-data',
    recordMode: recordMode,
    // Pass watch options and test generation through config
    config: __DEV__ ? {
      // Logging configuration: 'none' | 'error' | 'warn' | 'info' | 'debug'
      // Default is 'info' - set to 'none' to disable all logs (errors still logged)
      // Set to 'debug' for verbose logging during development
      logging: 'info', // or 'none', 'error', 'warn', 'debug'
      databaseProvider: {
        type: 'hybrid',
        path: 'mock-data',
        options: {
          watchFiles: true, // Enable automatic file watching
          watchInterval: 2000, // Check every 2 seconds
          onFilesChanged: () => {
            console.log('[Mockifyer] 📁 Mock files changed - will use new files on next request');
          },
        },
      },
      generateTests: {
        enabled: true,
        framework: 'jest',
        outputPath: './tests/generated', // Relative to project root (where Metro runs)
        groupBy: 'endpoint'
      },
    } : {},
  });
}
