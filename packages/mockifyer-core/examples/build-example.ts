#!/usr/bin/env ts-node
/**
 * Example build script showing how to use mock data during build time
 * 
 * Usage:
 *   ts-node examples/build-example.ts
 */

import {
  loadMockDataForBuild,
  generateStaticDataFile,
  generateTypesFromMockData,
  preprocessMockDataForBuild,
  getMockDataByUrl
} from '../src/utils/build-utils';
import path from 'path';

const mockDataPath = path.join(__dirname, './mock-data');
console.log(mockDataPath);

console.log('🔧 Build-time Mock Data Utilities Example\n');
console.log(`Using mock data path: ${mockDataPath}\n`);

// Example 1: Load all mock data
console.log('1️⃣ Loading all mock data...');
const allData = loadMockDataForBuild({
  mockDataPath,
  includeMetadata: true
});
console.log(`   Found ${allData.count} mock files\n`);

// Example 2: Filter and transform data
console.log('2️⃣ Loading filtered data (GET requests only)...');
const getRequests = loadMockDataForBuild({
  mockDataPath,
  filter: (filename, data) => data.request?.method === 'GET',
  transform: (data) => ({
    url: data.request.url,
    status: data.response.status,
    data: data.response.data
  })
});
console.log(`   Found ${getRequests.count} GET requests\n`);

// Example 3: Generate static data file
console.log('3️⃣ Generating static data file...');
try {
  const outputPath = path.join(__dirname, '../../dist/static-data.json');
  generateStaticDataFile({
    mockDataPath,
    outputPath,
    filter: (filename, data) => data.request?.method === 'GET',
    transform: (data) => data.response.data,
    format: 'json'
  });
  console.log('   ✅ Static data file generated\n');
} catch (error) {
  console.log('   ⚠️  Could not generate static file (dist directory may not exist)\n');
}

// Example 4: Generate TypeScript types
console.log('4️⃣ Generating TypeScript types...');
try {
  const typesPath = path.join(__dirname, '../../dist/mock-data-types.d.ts');
  generateTypesFromMockData({
    mockDataPath,
    outputPath: typesPath,
    typeName: 'MockApiResponse',
    filter: (filename, data) => data.request?.method === 'GET'
  });
  console.log('   ✅ TypeScript types generated\n');
} catch (error) {
  console.log('   ⚠️  Could not generate types (dist directory may not exist)\n');
}

// Example 5: Pre-process and group data
console.log('5️⃣ Pre-processing and grouping data...');
const processed = preprocessMockDataForBuild({
  mockDataPath,
  groupBy: 'method',
  sortBy: 'timestamp',
  sortOrder: 'desc',
  transform: (data) => ({
    method: data.request.method,
    url: data.request.url,
    status: data.response.status
  })
});

if (processed.grouped) {
  console.log('   Grouped by method:');
  Object.entries(processed.grouped).forEach(([method, items]) => {
    if (Array.isArray(items)) {
      console.log(`     ${method}: ${items.length} requests`);
    } else {
      console.log(`     ${method}: (items type not array, count unavailable)`);
    }
  });
  console.log('');
}

// Example 6: Quick lookup
console.log('6️⃣ Quick lookup example...');
if (allData.data.length > 0) {
  const firstItem = allData.data[0];
  if (firstItem.request?.url) {
    const found = getMockDataByUrl(mockDataPath, firstItem.request.url);
    console.log(`   Found data for URL: ${firstItem.request.url}`);
    console.log(`   Status: ${found?.response?.status || 'N/A'}\n`);
  }
}

console.log('✅ Build examples completed!');

