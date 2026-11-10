# Deterministic Dates with Sinon Fake Timers and Mockifyer

Mockifyer provides `getCurrentDate()` for getting manipulated dates, but for **deterministic dates** where `new Date()` and `Date.now()` return fake time globally, you can use Sinon fake timers alongside Mockifyer in Node.js environments.

## Why Use Fake Timers?

Mockifyer's `getCurrentDate()` returns manipulated dates, but it doesn't affect global `Date()` or `Date.now()`. If your code uses `new Date()` or `Date.now()` directly, you'll need fake timers to make those return deterministic dates.

**Use fake timers when:**
- Your code calls `new Date()` or `Date.now()` directly
- You need `setTimeout`/`setInterval` to work with fake time
- You want deterministic dates across your entire application
- You're testing time-dependent logic

## Using Sinon Fake Timers (Node.js)

### Installation

```bash
npm install --save-dev sinon @types/sinon
```

### Setting Up in Your Service

Here's how to set up Sinon fake timers alongside Mockifyer in your service:

```typescript
import sinon from 'sinon';
import { useFakeTimers } from 'sinon';
import { setupMockifyer, getCurrentDate } from '@sgedda/mockifyer-fetch';

// Initialize Mockifyer with date manipulation
const mockifyer = setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: false,
  dateManipulation: {
    fixedDate: '2024-12-25T00:00:00.000Z', // Mockifyer's date config
  },
});

// Setup Sinon fake timers for global Date manipulation
const fixedDate = '2024-12-25T00:00:00.000Z';
const clock = useFakeTimers({
  now: new Date(fixedDate), // Same date as Mockifyer
  toFake: ['Date', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'],
});

// Now both new Date() and getCurrentDate() return the same fake date
const globalDate = new Date(); // Returns 2024-12-25 (from Sinon)
const mockifyerDate = getCurrentDate(); // Returns 2024-12-25 (from Mockifyer)

// When done, restore real timers
// clock.restore();
```

### Example: Testing Time Progression

```typescript
import sinon from 'sinon';
import { useFakeTimers } from 'sinon';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

describe('Subscription Expiration', () => {
  let mockifyer: any;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    mockifyer = setupMockifyer({
      mockDataPath: './mock-data',
      recordMode: false,
    });

    // Start at a fixed date
    clock = useFakeTimers({
      now: new Date('2024-12-25T00:00:00.000Z'),
    });
  });

  afterEach(() => {
    clock.restore();
  });

  it('should handle subscription expiration', async () => {
    // API call mocked by Mockifyer
    const response = await fetch('https://api.example.com/subscription/1');
    const subscription = await response.json();

    // Current date is controlled by Sinon
    const currentDate = new Date(); // 2024-12-25
    expect(subscription.expiresAt > currentDate).toBe(true);

    // Advance time by 30 days
    clock.tick(30 * 24 * 60 * 60 * 1000);
    const futureDate = new Date(); // Now 2025-01-24

    // Check expiration logic
    if (subscription.expiresAt < futureDate) {
      expect(subscription.status).toBe('expired');
    }
  });
});
```

### Example: Testing Scheduled Tasks

```typescript
import sinon from 'sinon';
import { useFakeTimers } from 'sinon';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

describe('Scheduled Tasks', () => {
  let mockifyer: any;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    mockifyer = setupMockifyer({
      mockDataPath: './mock-data',
      recordMode: false,
    });

    clock = useFakeTimers({
      now: Date.now(),
    });
  });

  afterEach(() => {
    clock.restore();
  });

  it('should execute scheduled task at correct time', async () => {
    let taskExecuted = false;

    // Schedule a task to run in 1 hour
    setTimeout(async () => {
      const response = await fetch('https://api.example.com/scheduled-task');
      const data = await response.json();
      taskExecuted = true;
      expect(data.status).toBe('completed');
    }, 60 * 60 * 1000);

    // Fast-forward 1 hour
    await clock.tickAsync(60 * 60 * 1000);

    expect(taskExecuted).toBe(true);
  });
});
```


## Example: Using in a Service

Here's a complete example of setting up deterministic dates in a service:

```typescript
import sinon from 'sinon';
import { useFakeTimers } from 'sinon';
import { setupMockifyer, getCurrentDate } from '@sgedda/mockifyer-fetch';

// Service setup
const fixedDate = '2024-12-25T00:00:00.000Z';

// Initialize Mockifyer
const mockifyer = setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: false,
  dateManipulation: {
    fixedDate: fixedDate,
  },
});

// Setup Sinon fake timers for global Date manipulation
const clock = useFakeTimers({
  now: new Date(fixedDate),
  toFake: ['Date', 'setTimeout', 'setInterval'],
});

// Your service code can now use deterministic dates
function checkSubscriptionStatus(subscription: any) {
  // Both methods return the same fake date
  const currentDate = new Date(); // From Sinon - returns 2024-12-25
  const mockifyerDate = getCurrentDate(); // From Mockifyer - returns 2024-12-25
  
  if (subscription.expiresAt < currentDate) {
    return 'expired';
  }
  return 'active';
}

// Advance time if needed
clock.tick(30 * 24 * 60 * 60 * 1000); // 30 days later
const futureDate = new Date(); // Now returns 2025-01-24

// When done, restore real timers
// clock.restore();
```

## When Sinon Works

**Sinon fake timers work in:**
- ✅ Node.js environments (backend, CLI tools)
- ✅ Jest/Mocha/Vitest running in Node.js
- ❌ React Native (not recommended - use Mockifyer's `getCurrentDate()` instead)
- ❌ Browser production builds (not recommended - use Mockifyer's `getCurrentDate()` instead)

## Best Practices

1. **Use Mockifyer's `getCurrentDate()`** when you can - it's simpler and works everywhere
2. **Use Sinon fake timers** when your code uses `new Date()` or `Date.now()` directly in Node.js
3. **Keep dates in sync** - use the same date for Mockifyer config and fake timers
4. **Clean up** - always restore fake timers when done (`clock.restore()`)
5. **For React Native/Browser**: Use Mockifyer's `getCurrentDate()` instead of fake timers

## Summary

- **Mockifyer's `getCurrentDate()`**: Returns manipulated dates, doesn't affect global `Date()` - works everywhere
- **Sinon fake timers**: Global date manipulation for Node.js environments only
- **Together**: Use Mockifyer for API mocking and Sinon fake timers for deterministic global dates in Node.js

**Environment Guide:**
- **Node.js/Backend**: Mockifyer + Sinon fake timers ✅
- **React Native**: Mockifyer's `getCurrentDate()` only ✅
- **Browser**: Mockifyer's `getCurrentDate()` only ✅
