#!/usr/bin/env ts-node
/**
 * React Native Build Script
 * 
 * This script generates a TypeScript file from recorded mock data
 * for bundling with your React Native Expo app.
 * 
 * Usage:
 *   npm run generate:build-data
 *   or: ts-node scripts/generate-build-data.ts
 * 
 * Workflow:
 *   1. Record mocks during development using Expo FileSystem provider
 *   2. Extract recorded files from device to project/mock-data/
 *   3. Run this script to generate assets/mock-data.ts
 *   4. Build your app - Metro will bundle the TypeScript file
 *   5. App uses Memory provider with bundled data at runtime
 */

import { generateStaticDataFile } from '@sgedda/mockifyer-core/utils/build-utils';
import path from 'path';
import fs from 'fs';

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MOCK_DATA_PATH = path.join(PROJECT_ROOT, 'mock-data');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'assets', 'mock-data.ts');
const ASSETS_DIR = path.dirname(OUTPUT_PATH);

console.log('🔧 React Native Build Script: Generating Mock Data Bundle\n');
console.log(`Input:  ${MOCK_DATA_PATH}`);
console.log(`Output: ${OUTPUT_PATH}\n`);

// Ensure assets directory exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  console.log(`✅ Created assets directory: ${ASSETS_DIR}\n`);
}

// Check if mock data directory exists
if (!fs.existsSync(MOCK_DATA_PATH)) {
  console.error(`❌ Error: Mock data directory not found: ${MOCK_DATA_PATH}`);
  console.error('\nMake sure to:');
  console.error('  1. Record mocks during development');
  console.error('  2. Extract files from device to project/mock-data/');
  console.error('  3. Run this script again\n');
  process.exit(1);
}

try {
  // Generate static data file as TypeScript
  generateStaticDataFile({
    mockDataPath: MOCK_DATA_PATH,
    outputPath: OUTPUT_PATH,
    format: 'typescript',
    variableName: 'mockData',
    filter: (filename, data) => {
      // Optional: Filter which mocks to include
      // Example: Only include GET requests
      // return data.request?.method === 'GET';
      return true; // Include all mocks
    },
    transform: (data) => {
      // Transform to clean MockData format
      return {
        request: data.request,
        response: data.response,
        timestamp: data.timestamp,
        scenario: data.scenario,
        // Include request flow metadata if present
        sessionId: data.sessionId,
        requestId: data.requestId,
        parentRequestId: data.parentRequestId,
        source: data.source,
        callStack: data.callStack,
        duration: data.duration || data.responseTime,
      };
    }
  });

  console.log('✅ Successfully generated mock-data.ts for React Native bundle\n');
  console.log('Next steps:');
  console.log('  1. Build your React Native app');
  console.log('  2. Metro will automatically bundle assets/mock-data.ts');
  console.log('  3. App will use Memory provider with bundled data at runtime\n');
} catch (error: any) {
  console.error('❌ Error generating mock data file:', error.message);
  console.error('\nTroubleshooting:');
  console.error('  - Check that mock-data directory contains valid JSON files');
  console.error('  - Verify file permissions');
  console.error('  - Check error details above\n');
  process.exit(1);
}

