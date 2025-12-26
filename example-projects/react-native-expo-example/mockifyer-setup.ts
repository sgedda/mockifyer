/**
 * Mockifyer Setup for React Native Expo
 * 
 * This file implements conditional Mockifyer initialization:
 * - Development (Metro): Uses Expo FileSystem provider - can record mocks
 * - Production Build: Uses Memory provider with bundled TypeScript file
 * 
 * Usage:
 *   Import and call initializeMockifyer() in your App.tsx
 */

import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import { MemoryProvider, MockData } from '@sgedda/mockifyer-core';

// Lazy load bundled data (only used in production builds)
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
    const module = await import('./assets/mock-data');
    const data = Array.isArray(module.mockData) 
      ? module.mockData 
      : [module.mockData];
    
    bundledMockData = data;
    return data;
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
    console.log('[Mockifyer] Disabled');
    return;
  }

  if (__DEV__) {
    // DEVELOPMENT MODE (Metro bundler)
    // Use Expo FileSystem provider - can record and read from device filesystem
    const mockifyerConfig = {
      mockDataPath: 'mock-data',
      databaseProvider: {
        type: 'expo-filesystem' as const, // Use expo-filesystem for React Native
        path: 'mock-data',
      },
      generateTests: {
        enabled: true,
        framework: 'jest' as const,
        outputPath: './tests/generated', // Relative to project root (where Metro runs)
        groupBy: 'endpoint' as const
      },
      recordMode: process.env.MOCKIFYER_RECORD === 'true', // Enable recording if needed
      useGlobalFetch: true,
    };
    
    console.log('[Mockifyer Setup] 📝 Config being passed to setupMockifyer:', JSON.stringify({
      generateTests: mockifyerConfig.generateTests,
      recordMode: mockifyerConfig.recordMode,
      databaseProvider: mockifyerConfig.databaseProvider?.type
    }, null, 2));
    
    await setupMockifyer(mockifyerConfig);

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

