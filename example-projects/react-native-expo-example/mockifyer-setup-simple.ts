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
import { Platform } from 'react-native';

function getDefaultDashboardBaseUrl(): string {
  // "localhost" from the emulator/device is not always your host machine.
  // Android emulator: host loopback is 10.0.2.2
  // iOS simulator: localhost maps to the host machine
  return Platform.OS === 'android' ? 'http://10.0.2.2:3002' : 'http://localhost:3002';
}

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
  // In proxy + redis mode, `recordMode` controls whether the dashboard records cache-misses into Redis.
  // The app itself will not record locally while proxying is enabled.
  const recordMode = __DEV__ && true;
  
  // Option 2: Use expo-constants with .env file (requires additional setup)
  // Uncomment below if you have expo-constants and .env configured:
  // import Constants from 'expo-constants';
  // const recordMode = Constants.expoConfig?.extra?.MOCKIFYER_RECORD === 'true' || (__DEV__ && true);
  
  return await setupMockifyerForReactNative({
    isDev: __DEV__, // Pass React Native's __DEV__ variable
    mockDataPath: 'mock-data',
    bundledDataPath: './assets/mock-data',
    recordMode: recordMode,
    // Route all upstream requests through the dashboard proxy (dashboard must run with --provider redis)
    proxyBaseUrl: getDefaultDashboardBaseUrl(),
    // Pass watch options and test generation through config
    config: __DEV__ ? {
      // Logging configuration: 'none' | 'error' | 'warn' | 'info' | 'debug'
      // Default is 'info' - set to 'none' to disable all logs (errors still logged)
      // Set to 'debug' for verbose logging during development
      logging: 'info', // or 'none', 'error', 'warn', 'debug'
      databaseProvider: {
        // Keep an in-memory provider locally; Redis is the source-of-truth via proxy.
        type: 'memory',
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
