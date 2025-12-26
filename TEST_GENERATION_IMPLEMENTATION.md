# Test Generation Implementation Summary

## Overview

Implemented automatic test generation when recording mocks in Mockifyer. This feature creates unit tests automatically when mocks are saved, ensuring tests are always in sync with recorded data.

## What Was Implemented

### 1. Test Generator Utility (`packages/mockifyer-core/src/utils/test-generator.ts`)

- **TestGenerator class** - Generates test code from mock data
- **Framework support** - Jest, Vitest, and Mocha
- **GraphQL detection** - Automatically detects and handles GraphQL requests
- **Smart test naming** - Generates descriptive test names
- **File organization** - Groups tests by endpoint, scenario, or file

### 2. Configuration (`packages/mockifyer-core/src/types.ts`)

Added `generateTests` configuration to `MockifyerConfig`:

```typescript
generateTests?: {
  enabled?: boolean;
  framework?: 'jest' | 'vitest' | 'mocha';
  outputPath?: string;
  testPattern?: string;
  includeSetup?: boolean;
  groupBy?: 'endpoint' | 'scenario' | 'file';
}
```

### 3. Integration with mockifyer-fetch (`packages/mockifyer-fetch/src/index.ts`)

- Test generator initialized when `generateTests.enabled` is true
- Test generation called after mock is saved
- Handles both filesystem and database provider saves
- Appends to existing test files when appropriate

### 4. Integration with mockifyer-axios (`packages/mockifyer-axios/src/index.ts`)

- Same test generation logic for Axios-based projects
- Generates Axios-specific test code

### 5. Test Helper Package (`packages/mockifyer-test-helper/`)

- **Auto-setup utilities** - Zero-configuration test setup
- **Framework helpers** - `jestSetup()`, `vitestSetup()`, `mochaSetup()`
- **Scenario switching** - `useScenario()` helper
- **Auto-detection** - Finds mock data path automatically

## Usage Examples

### Enable Test Generation

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true,
  useGlobalFetch: true,
  generateTests: {
    enabled: true,
    framework: 'jest',
    outputPath: './tests/generated'
  }
});
```

### Use Test Helper for Auto-Setup

```typescript
// jest.setup.ts
import { jestSetup } from '@sgedda/mockifyer-test-helper';

jestSetup(); // Auto-setup for all tests
```

```typescript
// Your tests - zero setup!
describe('My Component', () => {
  it('works with realistic data', () => {
    // Test code - Mockifyer auto-setup!
  });
});
```

## Generated Test Example

```typescript
// tests/generated/api/users/1.test.ts - AUTO-GENERATED
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

describe('/api/users/1', () => {
  let mockifyer: any;

  beforeAll(() => {
    mockifyer = setupMockifyer({
      mockDataPath: './mock-data',
      recordMode: false,
      useGlobalFetch: true,
      scenario: 'default'
    });
  });

  it('should GET /api/users/1', async () => {
    const response = await fetch('https://api.example.com/users/1');
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: 1,
      name: 'John Doe',
      email: 'john@example.com'
    });
  });
});
```

## Features

✅ **Automatic generation** - Tests created when mocks are saved
✅ **Multiple frameworks** - Jest, Vitest, Mocha support
✅ **GraphQL support** - Detects and handles GraphQL requests
✅ **Smart grouping** - Organize by endpoint, scenario, or file
✅ **Realistic data** - Uses recorded real API responses
✅ **Zero boilerplate** - Setup code included
✅ **Test helper** - Auto-setup utilities

## Files Created/Modified

### New Files
- `packages/mockifyer-core/src/utils/test-generator.ts`
- `packages/mockifyer-core/TEST_GENERATION.md`
- `packages/mockifyer-test-helper/src/index.ts`
- `packages/mockifyer-test-helper/package.json`
- `packages/mockifyer-test-helper/tsconfig.json`
- `packages/mockifyer-test-helper/README.md`

### Modified Files
- `packages/mockifyer-core/src/types.ts` - Added `generateTests` config
- `packages/mockifyer-core/src/index.ts` - Exported test generator
- `packages/mockifyer-fetch/src/index.ts` - Integrated test generation
- `packages/mockifyer-axios/src/index.ts` - Integrated test generation

## Next Steps

1. Build packages:
   ```bash
   cd packages/mockifyer-core && npm run build
   cd packages/mockifyer-fetch && npm run build
   cd packages/mockifyer-axios && npm run build
   cd packages/mockifyer-test-helper && npm run build
   ```

2. Test the feature:
   - Enable test generation in a project
   - Record some mocks
   - Verify tests are generated
   - Run generated tests

3. Documentation:
   - Update main README with test generation feature
   - Add examples to documentation

## Benefits

- **Developer productivity** - Saves hours of manual test writing
- **Test coverage** - Automatic test generation increases coverage
- **Sync with mocks** - Tests always match recorded data
- **Realistic testing** - Uses real API responses
- **Better DX** - Zero boilerplate, auto-setup

