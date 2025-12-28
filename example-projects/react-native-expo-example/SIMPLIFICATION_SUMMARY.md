# Simplification Summary

This document explains the improvements made to simplify React Native Expo setup.

## What Was Simplified

### Before: Manual Setup Required

**Setup file:** ~100 lines of boilerplate code
- Manual conditional logic (`__DEV__` checks)
- Manual provider initialization
- Manual bundled data loading
- Manual error handling

**Build script:** ~95 lines of custom code
- Custom path resolution
- Custom file generation logic
- Manual error handling

### After: Simplified Setup

**Setup file:** ~10 lines using helper function
```typescript
import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch';

export async function initializeMockifyer() {
  return await setupMockifyerForReactNative({
    isDev: __DEV__, // Pass React Native's __DEV__ variable
    mockDataPath: 'mock-data',
    bundledDataPath: './assets/mock-data',
    recordMode: process.env.MOCKIFYER_RECORD === 'true',
  });
}
```

**Note:** The `isDev` parameter is required and must be passed from your application code. This keeps the package framework-agnostic and gives you control over dev/prod detection.

**Build script:** Use CLI tool directly
```bash
npm run generate:build-data
# Uses: mockifyer generate-bundle --input ./mock-data --output ./assets/mock-data.ts
```

## New Features Added

### 1. Helper Function: `setupMockifyerForReactNative()`

**Location:** `packages/mockifyer-fetch/src/react-native.ts`

**What it does:**
- Automatically detects dev/prod environment
- Handles provider switching (FileSystem ↔ Memory)
- Loads bundled data automatically
- Provides sensible defaults
- Still allows customization via config

**Usage:**
```typescript
import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch';

await setupMockifyerForReactNative({
  isDev: __DEV__, // Required: Pass your dev/prod detection logic
  mockDataPath: 'mock-data',
  bundledDataPath: './assets/mock-data',
  recordMode: true,
  config: {
    // Additional Mockifyer config options
  },
});
```

### 2. CLI Tool: `mockifyer generate-bundle`

**Location:** `packages/mockifyer-core/src/cli/generate-bundle.ts`

**What it does:**
- Generates bundles from mock data files
- Supports JSON, TypeScript, and JavaScript formats
- Configurable input/output paths
- Configurable variable names
- Built-in error handling

**Usage:**
```bash
# Basic usage
mockifyer generate-bundle

# With options
mockifyer generate-bundle \
  --input ./mock-data \
  --output ./assets/mock-data.ts \
  --format typescript \
  --variable-name mockData
```

**Available in:**
- `npx @sgedda/mockifyer-core generate-bundle`
- `npm run generate:build-data` (via package.json script)

## Code Reduction

| Component | Before | After | Reduction |
|-----------|--------|-------|-----------|
| Setup file | ~100 lines | ~10 lines | **90%** |
| Build script | ~95 lines | 1 line (CLI) | **99%** |
| **Total** | **~195 lines** | **~11 lines** | **94%** |

## Flexibility Maintained

Even with simplification, you still have full flexibility:

### Custom Setup (If Needed)

If you need more control, you can still use the manual approach:

```typescript
// mockifyer-setup.ts - Full control version
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import { MemoryProvider } from '@sgedda/mockifyer-core';

// ... custom implementation
```

### Custom Build Script (If Needed)

If you need custom filtering or transformation:

```typescript
// scripts/generate-build-data.ts
import { generateStaticDataFile } from '@sgedda/mockifyer-core';

generateStaticDataFile({
  // ... custom filter/transform logic
});
```

## Migration Path

### For Existing Projects

1. **Replace setup file:**
   - Option A: Use simplified version (`mockifyer-setup-simple.ts`)
   - Option B: Keep existing setup if you need custom logic

2. **Update build script:**
   ```json
   {
     "scripts": {
       "generate:build-data": "mockifyer generate-bundle --input ./mock-data --output ./assets/mock-data.ts"
     }
   }
   ```

3. **Update imports:**
   ```typescript
   // Old
   import { initializeMockifyer } from './mockifyer-setup';
   
   // New (simplified)
   import { initializeMockifyer } from './mockifyer-setup-simple';
   ```

## Benefits

✅ **Less code to maintain** - 94% reduction in boilerplate
✅ **Easier onboarding** - New developers can get started faster
✅ **Fewer bugs** - Less code means fewer places for bugs
✅ **Still flexible** - Can customize when needed
✅ **Better DX** - CLI tool with helpful error messages
✅ **Consistent** - Same approach across projects

## Files Created/Modified

### New Files
- `packages/mockifyer-fetch/src/react-native.ts` - Helper function
- `packages/mockifyer-core/src/cli/generate-bundle.ts` - CLI tool
- `example-projects/react-native-expo-example/mockifyer-setup-simple.ts` - Simplified example
- `example-projects/react-native-expo-example/SETUP_COMPARISON.md` - Comparison guide
- `example-projects/react-native-expo-example/SIMPLIFICATION_SUMMARY.md` - This file

### Modified Files
- `packages/mockifyer-fetch/src/index.ts` - Export React Native helpers
- `packages/mockifyer-core/src/index.ts` - Export CLI function
- `packages/mockifyer-core/package.json` - Add bin script
- `example-projects/react-native-expo-example/package.json` - Add CLI script
- `example-projects/react-native-expo-example/README.md` - Document both approaches

