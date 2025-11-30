# Using Mockifyer with React Native and Expo

Mockifyer can be used in React Native and Expo applications! You have **two options** for storage:

1. **Expo FileSystem Provider** (recommended) - Uses `expo-file-system` to persist files on the device
2. **Memory Provider** - In-memory storage (data lost on app restart)

## Quick Answer

**Yes, you can use Mockifyer in React Native/Expo with filesystem access!**

Use the **Expo FileSystem Provider** to:
- ✅ Save mock files to the device's filesystem
- ✅ Read mock files that persist across app restarts
- ✅ Record new API responses during development
- ✅ Access files locally on your development machine (via Metro)

## Setup for React Native/Expo

### Option 1: Expo FileSystem Provider (Recommended)

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

## Example: Complete React Native Setup

### Using Expo FileSystem Provider

```typescript
// mockifyer-setup.ts
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

export async function initializeMockifyer() {
  // Only enable in development
  if (__DEV__ && process.env.MOCKIFYER_ENABLED === 'true') {
    await setupMockifyer({
      mockDataPath: 'mock-data',
      databaseProvider: {
        type: 'expo-filesystem',
        path: 'mock-data',
      },
      recordMode: true, // Can record API responses!
    });

    console.log('[Mockifyer] Initialized with Expo FileSystem provider');
  }
}

// Call this in your App.tsx (make it async)
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

### Using Memory Provider

```typescript
// mockifyer-setup.ts
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import { MemoryProvider } from '@sgedda/mockifyer-core';

// Import your mock data files (bundled with Metro)
import userMock from './mocks/user.json';
import postsMock from './mocks/posts.json';

let provider: MemoryProvider | null = null;

export function initializeMockifyer() {
  // Only enable in development
  if (__DEV__ && process.env.MOCKIFYER_ENABLED === 'true') {
    provider = new MemoryProvider({});
    provider.initialize();

    // Pre-load mock data
    provider.save(userMock);
    provider.save(postsMock);

    setupMockifyer({
      mockDataPath: './mock-data',
      databaseProvider: {
        type: 'memory',
      },
      recordMode: false, // Can't record without filesystem
    });

    console.log('[Mockifyer] Initialized with memory provider');
  }
}

// Call this in your App.tsx or index.js
initializeMockifyer();
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

### Expo FileSystem Provider (Recommended)
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

