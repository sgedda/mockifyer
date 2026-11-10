#!/usr/bin/env ts-node
/**
 * Example: Generate TypeScript File from Mock Data
 * 
 * This example shows how to generate a TypeScript file with mock data
 * that can be bundled with your React Native app or other applications.
 * 
 * Usage:
 *   ts-node examples/generate-typescript-data.ts
 * 
 * This will generate: assets/mock-data.ts
 * 
 * The generated file can then be imported in your app:
 *   import { mockData } from './assets/mock-data';
 */

import { generateStaticDataFile } from '../src/utils/build-utils';
import path from 'path';
import fs from 'fs';

// Configuration
const MOCK_DATA_PATH = path.join(__dirname, '../../../mock-data');
const OUTPUT_PATH = path.join(__dirname, '../../assets/mock-data.ts');
const ASSETS_DIR = path.dirname(OUTPUT_PATH);

console.log('🔧 Generating TypeScript Mock Data File\n');
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
  console.error('\nMake sure mock data files exist in the mock-data directory.\n');
  process.exit(1);
}

try {
  // Generate TypeScript file with mock data
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
    transform: (data: any) => {
      // Transform to clean MockData format
      // Handle optional fields safely using 'any' type since mock files may have extra fields
      return {
        request: {
          method: data.request?.method,
          url: data.request?.url,
          headers: data.request?.headers || {},
          queryParams: data.request?.queryParams,
        },
        response: {
          status: data.response?.status,
          data: data.response?.data,
          headers: data.response?.headers || {},
        },
        timestamp: data.timestamp,
        scenario: data.scenario || undefined,
        // Include request flow metadata if present (these are optional fields)
        ...(data.sessionId && { sessionId: data.sessionId }),
        ...(data.requestId && { requestId: data.requestId }),
        ...(data.parentRequestId && { parentRequestId: data.parentRequestId }),
        ...(data.source && { source: data.source }),
        ...(data.callStack && { callStack: data.callStack }),
        ...(data.duration && { duration: data.duration }),
        ...(data.responseTime && { responseTime: data.responseTime }),
      };
    }
  });

  console.log('✅ Successfully generated mock-data.ts\n');
  console.log('Generated file structure:');
  console.log('  export const mockData = [');
  console.log('    {');
  console.log('      request: { method, url, headers, ... },');
  console.log('      response: { status, data, headers },');
  console.log('      timestamp: "...",');
  console.log('      scenario: undefined,');
  console.log('      // ... optional fields');
  console.log('    },');
  console.log('    // ... more mocks');
  console.log('  ] as const;\n');
  console.log('Usage in your app:');
  console.log('  import { mockData } from "./assets/mock-data";');
  console.log('  // mockData is typed and ready to use\n');
} catch (error: any) {
  console.error('❌ Error generating TypeScript file:', error.message);
  console.error('\nTroubleshooting:');
  console.error('  - Check that mock-data directory contains valid JSON files');
  console.error('  - Verify file permissions');
  console.error('  - Check error details above\n');
  process.exit(1);
}

