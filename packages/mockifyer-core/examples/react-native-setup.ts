/**
 * React Native Conditional Setup Example
 * 
 * This example shows how to conditionally use:
 * - Expo FileSystem provider in development (Metro bundler) - can record mocks
 * - Memory provider with bundled TypeScript file in production builds
 * 
 * Usage:
 *   1. Copy this file to your React Native project as mockifyer-setup.ts
 *   2. Run the build script to generate assets/mock-data.ts
 *   3. Import and call initializeMockifyer() in your App.tsx
 */

import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import { MemoryProvider } from '@sgedda/mockifyer-core';
import { MockData } from '@sgedda/mockifyer-core';

// Import bundled mock data (only used in production builds)
// Metro will tree-shake this in development if unused
let bundledMockData: MockData[] | null = null;

/**
 * Lazy load bundled data only when needed (production builds)
 * Uses dynamic import to ensure it's only loaded in production
 */
async function loadBundledMockData(): Promise<MockData[]> {
  if (bundledMockData) {
    return bundledMockData;
  }

  try {
    // Dynamic import - only loaded in production builds
    // Metro will bundle this file during build
    // @ts-ignore - Dynamic import path may not be resolved by TypeScript
    const module = await import('../assets/mock-data');
    bundledMockData = Array.isArray(module.mockData) 
      ? module.mockData 
      : [module.mockData];
    
    return bundledMockData;
  } catch (error) {
    console.warn('[Mockifyer] Could not load bundled mock data:', error);
    return [];
  }
}

/**
 * Initialize Mockifyer with conditional provider based on environment
 * 
 * Development (Metro): Uses Expo FileSystem provider - can record mocks
 * Production Build: Uses Memory provider with bundled TypeScript file
 */
export async function initializeMockifyer() {
  // Check if Mockifyer is enabled
  const isEnabled = process.env.MOCKIFYER_ENABLED === 'true' || __DEV__;
  if (!isEnabled) {
    return; // Disabled
  }

  if (__DEV__) {
    // DEVELOPMENT MODE (Metro bundler)
    // Use Expo FileSystem provider - can record and read from device filesystem
    await setupMockifyer({
      mockDataPath: 'mock-data',
      databaseProvider: {
        type: 'expo-filesystem',
        path: 'mock-data',
      },
      recordMode: process.env.MOCKIFYER_RECORD === 'true', // Enable recording if needed
    });

    console.log('[Mockifyer] Development mode: Using Expo FileSystem provider');
    if (process.env.MOCKIFYER_RECORD === 'true') {
      console.log('[Mockifyer] Recording mode enabled - new API responses will be saved');
    }
  } else {
    // PRODUCTION BUILD MODE
    // Use Memory provider with bundled TypeScript file
    const provider = new MemoryProvider({});
    await provider.initialize();

    // Load bundled mock data
    const mockDataArray = await loadBundledMockData();

    if (mockDataArray.length === 0) {
      console.warn('[Mockifyer] No bundled mock data found. Make sure to run the build script first.');
      return;
    }

    // Pre-load all mocks into memory
    for (const mockData of mockDataArray) {
      await provider.save(mockData);
    }

    await setupMockifyer({
      mockDataPath: './mock-data', // Not used with memory provider
      databaseProvider: {
        type: 'memory',
      },
      recordMode: false, // Can't record in production builds
    });

    console.log(`[Mockifyer] Production mode: Loaded ${mockDataArray.length} mocks from bundle`);
  }
}

/**
 * Alternative: Explicit mode control via environment variable
 * 
 * Set MOCKIFYER_MODE to:
 * - 'auto' (default): Use FileSystem in dev, Memory in production
 * - 'filesystem': Always use Expo FileSystem provider
 * - 'memory': Always use Memory provider with bundled data
 */
export async function initializeMockifyerWithExplicitMode() {
  const mockifyerMode = process.env.MOCKIFYER_MODE || 'auto'; // 'auto' | 'filesystem' | 'memory'
  
  // Determine which mode to use
  const useFileSystem = 
    mockifyerMode === 'filesystem' || 
    (mockifyerMode === 'auto' && __DEV__);

  if (useFileSystem) {
    // DEVELOPMENT: Expo FileSystem Provider
    await setupMockifyer({
      mockDataPath: 'mock-data',
      databaseProvider: {
        type: 'expo-filesystem',
        path: 'mock-data',
      },
      recordMode: process.env.MOCKIFYER_RECORD === 'true',
    });
    console.log('[Mockifyer] Using Expo FileSystem provider (development)');
  } else {
    // PRODUCTION: Memory Provider with bundled data
    const provider = new MemoryProvider({});
    await provider.initialize();

    const mockDataArray = await loadBundledMockData();

    if (mockDataArray.length === 0) {
      console.warn('[Mockifyer] No bundled mock data found. Make sure to run the build script first.');
      return;
    }

    for (const mockData of mockDataArray) {
      await provider.save(mockData);
    }

    await setupMockifyer({
      mockDataPath: './mock-data',
      databaseProvider: { type: 'memory' },
      recordMode: false,
    });
    console.log(`[Mockifyer] Using Memory provider (production): ${mockDataArray.length} mocks`);
  }
}

