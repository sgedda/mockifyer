# Test Generation with Mockifyer

Mockifyer can automatically generate unit tests when recording mocks. This feature creates test files that use your recorded mock data, ensuring tests are always in sync with your mocks.

## Features

- ✅ **Automatic test generation** - Tests created when mocks are saved
- ✅ **Multiple frameworks** - Supports Jest, Vitest, and Mocha
- ✅ **Realistic data** - Uses recorded real API responses
- ✅ **Zero setup** - Generated tests include all setup code
- ✅ **Smart grouping** - Organize tests by endpoint, scenario, or file

## Configuration

Enable test generation in your Mockifyer configuration:

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true,
  useGlobalFetch: true,
  
  // Enable test generation
  generateTests: {
    enabled: true,
    framework: 'jest', // 'jest' | 'vitest' | 'mocha'
    outputPath: './tests/generated',
    testPattern: '{endpoint}.test.ts',
    includeSetup: true,
    groupBy: 'file' // 'endpoint' | 'scenario' | 'file'
  }
});
```

## How It Works

### Step 1: Record Mocks

```typescript
// Your app code
const response = await fetch('https://api.example.com/users/1');
const user = await response.json();
```

When Mockifyer saves the mock, it automatically generates a test file.

### Step 2: Generated Test

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

### Step 3: Run Tests

```bash
npm test
# ✅ Tests pass - uses mock, no real API call!
```

## Configuration Options

### `enabled`
Enable or disable test generation.

```typescript
generateTests: {
  enabled: true // Default: false
}
```

### `framework`
Test framework to use.

```typescript
generateTests: {
  framework: 'jest' // 'jest' | 'vitest' | 'mocha'
}
```

### `outputPath`
Where to save generated tests.

```typescript
generateTests: {
  outputPath: './tests/generated' // Default: './tests/generated'
}
```

### `testPattern`
File naming pattern with placeholders.

```typescript
generateTests: {
  testPattern: '{endpoint}.test.ts' // Default: '{endpoint}.test.ts'
  // Placeholders: {endpoint}, {method}, {scenario}
}
```

### `includeSetup`
Include setup code in generated tests.

```typescript
generateTests: {
  includeSetup: true // Default: true
}
```

### `groupBy`
How to organize tests.

```typescript
generateTests: {
  groupBy: 'endpoint' // 'endpoint' | 'scenario' | 'file'
}
```

**Examples:**

- `groupBy: 'endpoint'` → `tests/generated/api/users/1.test.ts`
- `groupBy: 'scenario'` → `tests/generated/scenarios/happy-path/api/users/1.test.ts`
- `groupBy: 'file'` → `tests/generated/api_users_1.test.ts`

## GraphQL Support

GraphQL requests are automatically detected and handled:

```typescript
// Generated test for GraphQL
describe('/graphql', () => {
  it('should execute GetUsers query', async () => {
    const response = await fetch('https://api.example.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query GetUsers($limit: Int) {
          users(limit: $limit) {
            id
            name
          }
        }`,
        variables: { limit: 10 }
      })
    });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.data.users).toBeDefined();
  });
});
```

## React Native Example

```typescript
// React Native app
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

await setupMockifyer({
  mockDataPath: 'mock-data',
  databaseProvider: {
    type: 'expo-filesystem',
    path: 'mock-data',
  },
  recordMode: true,
  useGlobalFetch: true,
  generateTests: {
    enabled: true,
    framework: 'jest',
    outputPath: './tests/generated'
  }
});

// Make API calls - tests are generated automatically!
```

## Benefits

1. **Instant test coverage** - Tests generated automatically
2. **Always in sync** - Tests match recorded mocks
3. **Realistic data** - Uses real API responses
4. **Zero boilerplate** - Setup code included
5. **Faster development** - No manual test writing

## Best Practices

1. **Enable in development** - Generate tests while recording
2. **Review generated tests** - Customize as needed
3. **Use scenarios** - Test different states
4. **Group by endpoint** - Better organization
5. **Combine with test helper** - Use `@sgedda/mockifyer-test-helper` for auto-setup

## Example Workflow

```bash
# 1. Record mocks with test generation enabled
MOCKIFYER_ENABLED=true MOCKIFYER_RECORD=true npm start

# 2. Make API calls in your app
# → Mocks saved
# → Tests generated automatically

# 3. Run generated tests
npm test tests/generated

# 4. Tests pass with realistic data!
```

## Integration with Test Helper

Combine with `@sgedda/mockifyer-test-helper` for complete automation:

```typescript
// jest.setup.ts
import { jestSetup } from '@sgedda/mockifyer-test-helper';

jestSetup(); // Auto-setup for all tests
```

```typescript
// Your tests - zero setup!
describe('My Component', () => {
  it('works', () => {
    // Test code - Mockifyer auto-setup, realistic data ready!
  });
});
```

