# Test Generation in React Native

## Issue

Test generation wasn't working in React Native because:
1. Mocks are saved via database provider (expo-filesystem), not filesystem fallback
2. Test generation was only triggered in filesystem fallback path
3. fs/path modules need to be available for writing test files

## Solution

Test generation now works in React Native when:
- Running in Metro bundler (Node.js environment) - fs/path are available
- Test files are written to project folder (where Metro runs)
- Mocks are saved to device, but tests are generated on development machine

## Setup

### 1. Configure Mockifyer

```typescript
// mockifyer-setup.ts
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

export async function initializeMockifyer() {
  if (__DEV__) {
    await setupMockifyer({
      mockDataPath: 'mock-data',
      databaseProvider: {
        type: 'expo-filesystem', // ✅ Use expo-filesystem for React Native
        path: 'mock-data',
      },
      generateTests: {
        enabled: true, // ✅ Enable test generation
        framework: 'jest',
        outputPath: './tests/generated', // ✅ Relative to project root
        groupBy: 'endpoint'
      },
      recordMode: process.env.MOCKIFYER_RECORD === 'true',
      useGlobalFetch: true,
    });
  }
}
```

### 2. Run with Recording

```bash
MOCKIFYER_ENABLED=true MOCKIFYER_RECORD=true npm start
```

### 3. Make API Calls

When you make API calls in your React Native app:
- Mocks are saved to device (via expo-filesystem provider)
- Tests are generated to project folder (via Metro/Node.js fs/path)

## How It Works

1. **Mock Saving**: Mock saved to device via `expo-filesystem` provider
2. **Test Generation**: After mock is saved, test generation is triggered
3. **File Writing**: Test files written to project folder using Node.js `fs/path` (available in Metro)
4. **Result**: Test files appear in `./tests/generated/` folder

## Debugging

If tests aren't being generated, check:

1. **Test generation enabled?**
   ```typescript
   generateTests: {
     enabled: true // ✅ Must be true
   }
   ```

2. **Running in Metro?**
   - Metro bundler runs in Node.js - fs/path should be available
   - Check console for: `[Mockifyer-Fetch] 🔧 Test generator available: true`

3. **Check console logs:**
   ```
   [Mockifyer-Fetch] ✅ Successfully saved mock using provider
   [Mockifyer-Fetch] 🔧 Test generation enabled, attempting to generate test...
   [Mockifyer-Fetch] 🔧 Test generator available: true
   [Mockifyer-Fetch] 🔧 fs available: true
   [Mockifyer-Fetch] 🔧 path available: true
   [Mockifyer] ✅ Generated test: ./tests/generated/...
   ```

4. **Output path correct?**
   - Should be relative to project root: `'./tests/generated'`
   - Not device path: `'mock-data'`

## Common Issues

### Issue: Tests not generated

**Cause**: fs/path not available in React Native runtime

**Solution**: Tests are generated in Metro bundler (Node.js), not on device. Make sure you're running Metro and check console logs.

### Issue: Wrong provider type

**Cause**: Using `'filesystem'` instead of `'expo-filesystem'`

**Solution**: Use `type: 'expo-filesystem'` for React Native

### Issue: Output path wrong

**Cause**: Using device path instead of project path

**Solution**: Use `'./tests/generated'` (relative to project root), not `'mock-data'` (device path)

## Example

```typescript
// App.tsx
import { useEffect } from 'react';
import { initializeMockifyer } from './mockifyer-setup';

export default function App() {
  useEffect(() => {
    initializeMockifyer();
  }, []);

  const fetchData = async () => {
    // This will:
    // 1. Save mock to device (expo-filesystem)
    // 2. Generate test to ./tests/generated/ (Node.js fs)
    const response = await fetch('https://api.example.com/users/1');
    const data = await response.json();
  };

  return <Button onPress={fetchData} title="Fetch Data" />;
}
```

## Generated Test Location

Tests are generated in your project folder:
```
your-project/
  tests/
    generated/
      api/
        users/
          1.test.ts  ← Generated test
```

## Notes

- **Mocks**: Saved to device (expo-filesystem)
- **Tests**: Generated to project folder (Node.js fs)
- **Metro**: Runs in Node.js, so fs/path are available
- **Device**: Doesn't need fs/path - only Metro does

