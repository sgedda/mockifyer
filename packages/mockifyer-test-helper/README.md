# Mockifyer Test Helper

Test helper utilities for Mockifyer that provide automatic setup and realistic data for your tests.

## Features

- ✅ **Zero-configuration test setup** - Auto-detects mock data path
- ✅ **Realistic data** - Uses recorded API responses automatically
- ✅ **Framework support** - Works with Jest, Vitest, and Mocha
- ✅ **Scenario switching** - Easy scenario management in tests

## Installation

```bash
npm install @sgedda/mockifyer-test-helper
```

## Usage

### Auto-setup for Jest

```typescript
// jest.setup.ts
import { jestSetup } from '@sgedda/mockifyer-test-helper';

jestSetup(); // That's it!
```

```typescript
// Your tests - zero setup!
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import App from '../App';

describe('App Component', () => {
  it('should display posts', async () => {
    const { getByText } = render(<App />);
    
    fireEvent.press(getByText('Load Posts'));
    
    // Uses REALISTIC data from recorded API calls!
    await waitFor(() => {
      expect(getByText('sunt aut facere repellat')).toBeTruthy();
    });
  });
});
```

### Auto-setup for Vitest

```typescript
// vitest.setup.ts
import { vitestSetup } from '@sgedda/mockifyer-test-helper';

vitestSetup();
```

### Auto-setup for Mocha

```typescript
// mocha.setup.ts
import { mochaSetup } from '@sgedda/mockifyer-test-helper';

mochaSetup();
```

### Manual Setup

```typescript
import { setupTestMocks } from '@sgedda/mockifyer-test-helper';

beforeAll(() => {
  setupTestMocks({
    scenario: 'happy-path',
    mockDataPath: './custom-mock-data'
  });
});
```

### Scenario Switching

```typescript
import { useScenario } from '@sgedda/mockifyer-test-helper';

describe('Different scenarios', () => {
  it('should handle empty state', () => {
    useScenario('empty-posts');
    
    const { getByText } = render(<App />);
    fireEvent.press(getByText('Load Posts'));
    
    expect(getByText('No posts available')).toBeTruthy();
  });

  it('should handle errors', () => {
    useScenario('error-500');
    
    const { getByText } = render(<App />);
    fireEvent.press(getByText('Load Posts'));
    
    expect(getByText('Something went wrong')).toBeTruthy();
  });
});
```

## Configuration

The helper auto-detects mock data path from:
1. `MOCKIFYER_PATH` environment variable
2. `MOCKIFYER_MOCK_DATA_PATH` environment variable
3. `./mock-data` (project root)
4. `./test-mock-data` (project root)
5. `./__tests__/mock-data`
6. `./tests/mock-data`

## Benefits

- **Zero boilerplate** - No manual setup code needed
- **Realistic data** - Uses recorded real API responses
- **Faster tests** - No network calls, instant responses
- **Better coverage** - Tests match production behavior

