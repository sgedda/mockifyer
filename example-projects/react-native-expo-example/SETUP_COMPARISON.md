# Setup Comparison: Simplified vs Full Control

This document compares the two approaches for setting up Mockifyer in React Native Expo.

## Simplified Setup (Recommended)

**File:** `mockifyer-setup-simple.ts`

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

**Lines of code:** ~10 lines

**Pros:**
- ✅ Minimal boilerplate
- ✅ Automatic dev/prod detection
- ✅ Handles all provider switching internally
- ✅ Less code to maintain
- ✅ Uses package-provided helper

**Cons:**
- ⚠️ Less control over initialization flow
- ⚠️ Less visibility into what's happening internally

## Full Control Setup

**File:** `mockifyer-setup.ts`

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import { MemoryProvider, MockData } from '@sgedda/mockifyer-core';

let bundledMockData: MockData[] | null = null;

async function loadBundledMockData(): Promise<MockData[]> {
  // ... manual loading logic
}

export async function initializeMockifyer() {
  // ... manual conditional logic
  if (__DEV__) {
    // ... development setup
  } else {
    // ... production setup
  }
}
```

**Lines of code:** ~100+ lines

**Pros:**
- ✅ Complete control over initialization
- ✅ Custom loading logic
- ✅ Full visibility into what's happening
- ✅ Advanced customization options
- ✅ Can add custom error handling

**Cons:**
- ⚠️ More boilerplate code
- ⚠️ More code to maintain
- ⚠️ Need to understand provider internals

## Recommendation

**Use Simplified Setup** unless you need:
- Custom error handling during bundle loading
- Custom filtering/transformation of bundled data
- Advanced provider configuration
- Complete control over the initialization flow

For 90% of use cases, the simplified setup is sufficient and much easier to maintain.

