# Using Mockifyer with React Native and Expo

Mockifyer can be used in React Native and Expo applications! You have **three options** for storage:

1. **Hybrid Provider** (recommended for development) - Saves to both device AND project folder simultaneously
2. **Expo FileSystem Provider** - Uses `expo-file-system` to persist files on the device
3. **Memory Provider** - In-memory storage (data lost on app restart)

## Quick Answer

**Yes, you can use Mockifyer in React Native/Expo with filesystem access!**

Use the **Expo FileSystem Provider** to:
- ✅ Save mock files to the device's filesystem
- ✅ Read mock files that persist across app restarts
- ✅ Record new API responses during development
- ✅ Access files locally on your development machine (via Metro)

## Setup for React Native/Expo

### Option 0: Hybrid Provider (Recommended for Development)

The Hybrid Provider saves mock files to **both** device filesystem and your project folder simultaneously. This is perfect for development as files are immediately available in your codebase.

#### 1. Install Dependencies

```bash
npm install @sgedda/mockifyer-fetch
# or if using axios
npm install @sgedda/mockifyer-axios

# Install expo-file-system
npx expo install expo-file-system
```

#### 2. Configure Metro with Sync Middleware

```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');

const config = getDefaultConfig(__dirname);

// One function call handles BOTH:
// 1. FS/path stubbing (for bundling)
// 2. Sync middleware (for Hybrid Provider to save files to project folder)
module.exports = configureMetroForMockifyer(config, {
  syncMiddleware: {
    projectRoot: __dirname,
    mockDataPath: './mock-data',
  },
});
```

#### 3. Configure with Hybrid Provider

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  mockDataPath: './mock-data',
  databaseProvider: {
    type: 'hybrid', // ✅ Saves to both device AND project folder
    path: 'mock-data',
  },
  recordMode: true,
  useGlobalFetch: true,
});
```

**Files are saved to:**
- Device: `FileSystem.documentDirectory + 'mock-data'`
- Project folder: `./mock-data/` (in your codebase)

**Benefits:**
- ✅ Files immediately available in your project folder (no polling delay)
- ✅ Can search/edit files in your code editor
- ✅ Files persist on device for app access
- ✅ Perfect for development workflow

### Option 1: Expo FileSystem Provider

#### 1. Install Dependencies

```bash
npm install @sgedda/mockifyer-fetch
# or if using axios
npm install @sgedda/mockifyer-axios

# Install expo-file-system
npx expo install expo-file-system
```

#### 2. Configure with Expo FileSystem Provider

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

// Initialize with expo-filesystem provider
setupMockifyer({
  mockDataPath: 'mock-data', // Relative path in document directory
  databaseProvider: {
    type: 'expo-filesystem', // Uses expo-file-system
    path: 'mock-data', // Directory name in document directory
  },
  recordMode: true, // Can record new API responses!
  // Your other config...
});
```

**Files are stored in:** `FileSystem.documentDirectory + 'mock-data'`

### Option 2: Memory Provider (No Persistence)

#### 1. Install Mockifyer

```bash
npm install @sgedda/mockifyer-fetch
# or if using axios
npm install @sgedda/mockifyer-axios
```

#### 2. Configure with Memory Provider

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

// Initialize with memory provider (no filesystem access needed)
setupMockifyer({
  mockDataPath: './mock-data', // Still required but not used with memory provider
  databaseProvider: {
    type: 'memory', // Use in-memory storage
  },
  // Your other config...
});
```

### 3. Access Files During Development

With Expo FileSystem Provider, files are stored on the device. To access them during development:

#### Option A: Use Expo Dev Tools
- Files are in the app's document directory
- Use `expo-file-system` APIs to read/write
- Files persist across app restarts

#### Option B: Export/Share Files
```typescript
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Share a mock file
const fileUri = FileSystem.documentDirectory + 'mock-data/your-file.json';
await Sharing.shareAsync(fileUri);
```

### 4. Pre-load Mock Data (Memory Provider Only)

Since the memory provider doesn't persist data, you can pre-load mocks from bundled JSON files:

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import { MemoryProvider } from '@sgedda/mockifyer-core';
import mockData1 from './mocks/api-response-1.json';
import mockData2 from './mocks/api-response-2.json';

const provider = new MemoryProvider({});
provider.initialize();

// Pre-load your mock data
provider.save(mockData1);
provider.save(mockData2);

setupMockifyer({
  mockDataPath: './mock-data',
  databaseProvider: {
    type: 'memory',
  },
  // The provider will use the pre-loaded data
});
```

## Limitations

### Expo FileSystem Provider

- **Files are device-specific**: Files are stored on the device, not on your development machine
- **Sandboxed storage**: Files are in the app's document directory (not accessible via file manager)
- **Async operations**: All file operations are async (unlike Node.js fs)

### Memory Provider Limitations

- **Data is lost on app restart**: All mocks are stored in memory and cleared when the app closes
- **No recording mode**: Can't record new API responses (would need filesystem access)
- **Pre-loading required**: You need to manually load mock data at startup

### Workarounds

1. **Use Expo FileSystem Provider**: For persistent storage and recording capabilities
2. **Bundle mock data**: Include JSON files in your app bundle and load them at startup
3. **Use Metro bundler**: Import JSON files directly - they'll be bundled with your app
4. **Development only**: Use mockifyer primarily for development/testing, not production

## Recommended: Conditional Setup (Development + Production)

**Best Practice**: Use Expo FileSystem provider in development (Metro) and Memory provider with bundled TypeScript file in production builds.

### Complete Workflow

1. **Development**: Record mocks using Expo FileSystem provider
2. **Build**: Generate TypeScript file from recorded mocks
3. **Production**: Use Memory provider with bundled file

### Step 1: Setup Conditional Initialization

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
    // DEVELOPMENT: Expo FileSystem Provider (can record)
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
    // PRODUCTION: Memory Provider with bundled data
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

### Step 2: Create Build Script

```typescript
// scripts/generate-build-data.ts
import { generateStaticDataFile } from '@sgedda/mockifyer-core/utils/build-utils';
import path from 'path';

generateStaticDataFile({
  mockDataPath: path.join(__dirname, '../mock-data'),
  outputPath: path.join(__dirname, '../assets/mock-data.ts'),
  format: 'typescript',
  variableName: 'mockData',
  transform: (data) => ({
    request: data.request,
    response: data.response,
    timestamp: data.timestamp,
    scenario: data.scenario
  })
});
```

### Step 3: Add to package.json

```json
{
  "scripts": {
    "dev": "react-native start",
    "dev:record": "MOCKIFYER_ENABLED=true MOCKIFYER_RECORD=true react-native start",
    "generate:build-data": "ts-node scripts/generate-build-data.ts",
    "prebuild": "npm run generate:build-data",
    "build:ios": "npm run generate:build-data && react-native run-ios",
    "build:android": "npm run generate:build-data && react-native run-android"
  }
}
```

### Step 4: Use in App.tsx

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

### Workflow Summary

**Development (Metro):**
- Uses `__DEV__ === true`
- Expo FileSystem provider
- Can record new mocks
- Files stored on device

**Production Build:**
- Uses `__DEV__ === false`
- Memory provider
- Loads from bundled `mock-data.ts`
- No filesystem dependency
- Faster (in-memory access)

## Alternative: Simple Setup Examples

### Using Expo FileSystem Provider Only

```typescript
// mockifyer-setup.ts
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

export async function initializeMockifyer() {
  if (__DEV__ && process.env.MOCKIFYER_ENABLED === 'true') {
    await setupMockifyer({
      mockDataPath: 'mock-data',
      databaseProvider: {
        type: 'expo-filesystem',
        path: 'mock-data',
      },
      recordMode: true,
    });
  }
}
```

### Using Memory Provider Only

```typescript
// mockifyer-setup.ts
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import { MemoryProvider } from '@sgedda/mockifyer-core';
import userMock from './mocks/user.json';
import postsMock from './mocks/posts.json';

export function initializeMockifyer() {
  if (__DEV__ && process.env.MOCKIFYER_ENABLED === 'true') {
    const provider = new MemoryProvider({});
    provider.initialize();
    provider.save(userMock);
    provider.save(postsMock);

    setupMockifyer({
      mockDataPath: './mock-data',
      databaseProvider: { type: 'memory' },
      recordMode: false,
    });
  }
}
```

## File Access During Development

### Where are files stored?

With Expo FileSystem Provider, files are stored at:
```
FileSystem.documentDirectory + 'mock-data/'
```

Example path on iOS simulator:
```
/Users/yourname/Library/Developer/CoreSimulator/Devices/.../data/Containers/Data/Application/.../Documents/mock-data/
```

### Reading files programmatically

```typescript
import * as FileSystem from 'expo-file-system';

// List all mock files
const mockDir = FileSystem.documentDirectory + 'mock-data';
const files = await FileSystem.readDirectoryAsync(mockDir);

// Read a specific file
const fileUri = mockDir + '/' + files[0];
const content = await FileSystem.readAsStringAsync(fileUri);
const mockData = JSON.parse(content);
```

### Sharing files for inspection

```typescript
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Share all mock files (for debugging)
const mockDir = FileSystem.documentDirectory + 'mock-data';
const files = await FileSystem.readDirectoryAsync(mockDir);

for (const file of files) {
  const fileUri = mockDir + '/' + file;
  await Sharing.shareAsync(fileUri);
}
```

## Environment Variables

You can still use environment variables in React Native (via `react-native-config` or similar):

```bash
# .env
MOCKIFYER_ENABLED=true
MOCKIFYER_DB_PROVIDER=memory
```

## Summary

### Hybrid Provider (Recommended for Development)
✅ **Works in React Native/Expo** with filesystem access  
✅ **Saves to both device AND project folder** simultaneously  
✅ **Files immediately available** in your codebase (no polling delay)  
✅ **Files persist** across app restarts  
✅ **Can record new API responses**  
✅ **Perfect for development** - can search/edit files in code editor  
⚠️ **Requires Metro sync middleware** (automatically set up with `configureMetroForMockifyer`)  
💡 **Best choice for development** - files appear in project folder instantly

### Expo FileSystem Provider
✅ **Works in React Native/Expo** with filesystem access  
✅ **Files persist** across app restarts  
✅ **Can record new API responses**  
✅ **Perfect for development/testing**  
⚠️ **Files stored on device** (not directly accessible from dev machine)  
💡 **Use expo-file-system** APIs to access files programmatically

### Memory Provider
✅ **Works in React Native/Expo** without filesystem  
✅ **No dependencies** needed  
⚠️ **Data doesn't persist** (lost on app restart)  
⚠️ **Can't record new mocks** (would need filesystem)  
💡 **Pre-load mock data** from bundled JSON files

