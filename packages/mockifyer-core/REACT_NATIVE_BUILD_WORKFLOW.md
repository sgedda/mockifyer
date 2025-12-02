# React Native Build Workflow: Recording → Generating → Bundling Mock Data

This guide explains the complete workflow for recording mock data during development, generating a static TypeScript file, and bundling it with your React Native app.

## Overview

The workflow consists of three phases:

1. **Development Phase**: Record API calls → Save individual mock files
2. **Build Phase**: Generate static TypeScript file → Bundle with app
3. **Runtime Phase**: Load bundled file → Use Memory Provider

## Phase 1: Development - Recording Mock Data

### Step 1: Setup Mockifyer for Recording

```typescript
// mockifyer-setup.ts
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import * as FileSystem from 'expo-file-system';

export async function initializeMockifyer() {
  if (__DEV__ && process.env.MOCKIFYER_ENABLED === 'true') {
    await setupMockifyer({
      mockDataPath: 'mock-data',
      databaseProvider: {
        type: 'expo-filesystem',
        path: 'mock-data',
      },
      recordMode: true, // Enable recording
    });
    
    console.log('[Mockifyer] Recording mode enabled');
    console.log(`[Mockifyer] Files saved to: ${FileSystem.documentDirectory}mock-data`);
  }
}
```

### Step 2: Record API Calls

Run your app and make API calls. Mockifyer will save each response as a JSON file in the device's document directory.

```bash
# Start Metro with recording enabled
MOCKIFYER_ENABLED=true MOCKIFYER_RECORD=true react-native start
```

### Step 3: Extract Recorded Files

Create a script to extract recorded files from the device:

```typescript
// scripts/extract-mock-data.ts
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function extractMockData() {
  const mockDir = FileSystem.documentDirectory + 'mock-data';
  const files = await FileSystem.readDirectoryAsync(mockDir);
  
  console.log(`Found ${files.length} mock files`);
  
  // Share files for manual copy
  for (const file of files) {
    const fileUri = mockDir + '/' + file;
    await Sharing.shareAsync(fileUri);
  }
}
```

**Alternative: Use Expo Dev Tools**
- Open Expo Dev Tools
- Navigate to File System
- Copy files from `documentDirectory/mock-data/` to your project

## Phase 2: Build - Generate Static TypeScript File

### Step 1: Copy Recorded Files to Project

Copy the extracted mock files to your project:

```
your-react-native-app/
  ├── mock-data/              # Development recordings
  │   ├── 2024-01-01_GET_api_example_com_posts.json
  │   ├── 2024-01-01_GET_api_example_com_users.json
  │   └── ...
  ├── scripts/
  │   └── generate-build-data.ts
  └── assets/
      └── mock-data.ts        # Generated TypeScript file (bundled with app)
```

### Step 2: Create Build Script

```typescript
// scripts/generate-build-data.ts
import { generateStaticDataFile } from '@sgedda/mockifyer-core/utils/build-utils';
import path from 'path';
import fs from 'fs';

const mockDataPath = path.join(__dirname, '../mock-data');
const outputPath = path.join(__dirname, '../assets/mock-data.ts');
const assetsDir = path.dirname(outputPath);

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Generate static data file as TypeScript
generateStaticDataFile({
  mockDataPath,
  outputPath,
  format: 'typescript',
  variableName: 'mockData',
  filter: (filename, data) => {
    // Optional: Filter which mocks to include
    // Example: Only include GET requests
    // return data.request?.method === 'GET';
    return true; // Include all mocks
  },
  transform: (data) => {
    // Return clean MockData format
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

console.log('✅ Generated mock-data.ts for bundling');
```

### Step 3: Add to Build Process

Add to your `package.json`:

```json
{
  "scripts": {
    "dev": "react-native start",
    "dev:record": "MOCKIFYER_ENABLED=true MOCKIFYER_RECORD=true react-native start",
    "generate:build-data": "ts-node scripts/generate-build-data.ts",
    "prebuild": "npm run generate:build-data",
    "build:ios": "npm run generate:build-data && react-native run-ios --configuration Release",
    "build:android": "npm run generate:build-data && react-native run-android --mode release"
  }
}
```

## Phase 3: Runtime - Load Bundled File

### Step 1: Conditional Setup

```typescript
// mockifyer-setup.ts
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import { MemoryProvider } from '@sgedda/mockifyer-core';
import { MockData } from '@sgedda/mockifyer-core';

// Lazy load bundled data (only in production)
let bundledMockData: MockData[] | null = null;

async function loadBundledMockData(): Promise<MockData[]> {
  if (bundledMockData) return bundledMockData;
  
  try {
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

export async function initializeMockifyer() {
  const isEnabled = process.env.MOCKIFYER_ENABLED === 'true' || __DEV__;
  if (!isEnabled) return;

  if (__DEV__) {
    // DEVELOPMENT: Expo FileSystem Provider
    await setupMockifyer({
      mockDataPath: 'mock-data',
      databaseProvider: {
        type: 'expo-filesystem',
        path: 'mock-data',
      },
      recordMode: process.env.MOCKIFYER_RECORD === 'true',
    });
    console.log('[Mockifyer] Development: Using Expo FileSystem provider');
  } else {
    // PRODUCTION: Memory Provider with bundled TypeScript file
    const provider = new MemoryProvider({});
    await provider.initialize();

    const mockDataArray = await loadBundledMockData();
    if (mockDataArray.length === 0) {
      console.warn('[Mockifyer] No bundled mock data found');
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
    console.log(`[Mockifyer] Production: Loaded ${mockDataArray.length} mocks from bundle`);
  }
}
```

### Step 2: Use in App

```typescript
// App.tsx
import { useEffect } from 'react';
import { initializeMockifyer } from './mockifyer-setup';

export default function App() {
  useEffect(() => {
    initializeMockifyer();
  }, []);

  // ... rest of your app
}
```

## Complete Workflow Example

### Development Workflow

```bash
# 1. Start app in recording mode
npm run dev:record

# 2. Use app, make API calls (mocks are recorded to device)

# 3. Extract recorded files (manual or via script)
# Copy files from device to project/mock-data/

# 4. Generate build data
npm run generate:build-data
```

### Build Workflow

```bash
# Build automatically generates mock-data.ts and bundles it
npm run build:ios
# or
npm run build:android
```

### Runtime

The app automatically:
- Uses Expo FileSystem provider in development (Metro)
- Uses Memory provider with bundled `mock-data.ts` in production builds

## Benefits of TypeScript Format

- ✅ **Type Safety**: TypeScript can infer types from the `as const` assertion
- ✅ **Better IDE Support**: Autocomplete and type checking
- ✅ **No Runtime Parsing**: Direct import, no JSON.parse needed
- ✅ **Tree-shaking**: Bundlers can optimize unused mocks
- ✅ **Smaller Bundle**: Only includes mocks that are actually used

## Generated File Example

The build script generates `assets/mock-data.ts`:

```typescript
export const mockData = [
  {
    request: {
      method: "GET",
      url: "https://api.example.com/posts",
      // ...
    },
    response: {
      status: 200,
      data: {
        // ...
      }
    },
    timestamp: "2024-01-01T00:00:00.000Z",
    scenario: undefined
  },
  // ... more mocks
] as const;
```

## Troubleshooting

### No bundled mock data found

**Problem**: `[Mockifyer] No bundled mock data found`

**Solution**:
1. Make sure you've run the build script: `npm run generate:build-data`
2. Check that `assets/mock-data.ts` exists
3. Verify the import path in `mockifyer-setup.ts` matches your file structure

### Metro bundler can't find TypeScript file

**Problem**: Import errors during bundling

**Solution**:
1. Ensure the file is in the `assets/` directory (or configured Metro asset path)
2. Check that TypeScript files are included in Metro's asset extensions
3. Verify the file path in the import statement

### Recording not working in development

**Problem**: Mocks aren't being saved

**Solution**:
1. Check that `MOCKIFYER_RECORD=true` is set
2. Verify `expo-file-system` is installed
3. Check device permissions for file system access

## Summary

**Development Flow:**
1. Record → Use Expo FileSystem provider, record API calls
2. Extract → Copy files from device to project
3. Generate → Create TypeScript file using build utils
4. Bundle → Metro bundles the TypeScript file automatically
5. Runtime → Conditional setup loads appropriate provider

**Key Points:**
- ✅ Record during development with Expo FileSystem provider
- ✅ Generate TypeScript file during build
- ✅ Bundle TypeScript file with app (Metro handles this)
- ✅ Conditional setup switches providers automatically
- ✅ No filesystem needed at runtime in production (all data in memory)

