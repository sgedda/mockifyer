# Date Manipulation in React Native

**Yes, date manipulation works in React Native/Expo apps!** 🎉

## How It Works

Date manipulation in Mockifyer uses a **two-tier approach** for maximum compatibility:

1. **Sinon Fake Timers** (when available) - Manipulates global `Date` and `Date.now()` for all code
2. **Fallback Method** (always available) - Returns manipulated dates via `getCurrentDate()` function

### React Native Compatibility

- ✅ **Works in React Native** - The fallback method doesn't require Sinon
- ✅ **Works in Expo** - No special configuration needed
- ✅ **Works in Production Builds** - Sinon is optional and gracefully falls back
- ✅ **Works in Tests** - Sinon is available in test environments

## Usage in React Native

### Basic Setup

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import { getCurrentDate } from '@sgedda/mockifyer-core';

// Initialize with date manipulation
await setupMockifyer({
  mockDataPath: 'mock-data',
  dateManipulation: {
    fixedDate: '2024-06-20T00:00:00.000Z', // Set a fixed date
    // OR
    offset: 24 * 60 * 60 * 1000, // Add 24 hours offset
    // OR
    timezone: 'America/New_York', // Set timezone
  },
});
```

### Using Manipulated Dates

```typescript
import { getCurrentDate } from '@sgedda/mockifyer-core';

// Get the manipulated current date
const currentDate = getCurrentDate();
console.log('Current date:', currentDate.toISOString());

// Use in your API responses or business logic
const subscriptionEnd = new Date(currentDate);
subscriptionEnd.setDate(subscriptionEnd.getDate() + 30); // 30 days from now
```

### Example: Subscription API

```typescript
import { getCurrentDate } from '@sgedda/mockifyer-core';

// In your API handler or service
function getSubscriptionStatus() {
  const currentDate = getCurrentDate();
  const expirationDate = new Date('2024-12-31T00:00:00.000Z');
  
  const daysRemaining = Math.ceil(
    (expirationDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return {
    status: daysRemaining > 0 ? 'active' : 'expired',
    daysRemaining: Math.max(0, daysRemaining),
  };
}
```

## How It Works Under the Hood

### In Node.js/Test Environments

When Sinon is available (Node.js, Jest tests):
- ✅ Sinon fake timers **CAN** manipulate global `Date` and `Date.now()`
- ✅ All code using `new Date()` or `Date.now()` automatically gets the manipulated time
- ✅ More powerful - affects all date operations globally
- ✅ Works because Node.js allows global object manipulation

### In React Native Production Builds

**❌ Sinon fake timers DO NOT work in React Native production builds**

**Why?**
- Sinon relies on Node.js-specific APIs that aren't available in React Native
- React Native uses Hermes or JSC runtime, not Node.js V8
- Even if Sinon could be bundled, manipulating global `Date` in React Native is complex due to:
  - Native bridge interactions (Date operations may go through native code)
  - Different JavaScript engine architecture
  - Security restrictions in mobile runtimes

**What works instead:**
- ✅ Sinon is gracefully skipped (doesn't crash)
- ✅ `getCurrentDate()` uses the fallback method
- ✅ Returns manipulated dates based on config/environment variables
- ⚠️ **You MUST use `getCurrentDate()` instead of `new Date()`** for manipulated dates
- ⚠️ `new Date()` will return the **real current date** (not manipulated)

## Important Notes

### ⚠️ Use `getCurrentDate()` for Manipulated Dates

In React Native production builds, you **must use `getCurrentDate()`** to get manipulated dates:

```typescript
// ✅ Correct - Uses manipulated date
const date = getCurrentDate();

// ❌ Incorrect - Uses real current date (in production builds)
const date = new Date();
```

### Environment Variables

You can also use environment variables (useful for CI/CD):

```bash
# Set fixed date
MOCKIFYER_DATE=2024-06-20T00:00:00.000Z

# Set offset (milliseconds)
MOCKIFYER_DATE_OFFSET=86400000  # 24 hours

# Set timezone
MOCKIFYER_TIMEZONE=America/New_York
```

### Testing

In test environments (Jest running in Node.js), Sinon is available, so date manipulation works globally:

```typescript
import { setupMockifyer, getCurrentDate } from '@sgedda/mockifyer-core';

beforeEach(() => {
  setupMockifyer({
    mockDataPath: './mock-data',
    dateManipulation: {
      fixedDate: '2024-01-01T00:00:00.000Z',
    },
  });
});

test('should use manipulated date', () => {
  // In Node.js tests, Sinon manipulates global Date
  // So new Date() also returns manipulated date (Sinon active)
  const date1 = new Date();
  const date2 = getCurrentDate();
  
  expect(date1.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  expect(date2.toISOString()).toBe('2024-01-01T00:00:00.000Z');
});
```

**Note:** This only works in Node.js test environments. In React Native tests (if running on-device testing), Sinon won't be available and you'll need to use `getCurrentDate()`.

## Complete React Native Example

```typescript
// mockifyer-setup.ts
import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch';

export async function initializeMockifyer() {
  await setupMockifyerForReactNative({
    isDev: __DEV__,
    mockDataPath: 'mock-data',
    bundledDataPath: './assets/mock-data',
    recordMode: __DEV__,
    config: {
      dateManipulation: {
        fixedDate: '2024-06-20T00:00:00.000Z', // Set your test date
      },
    },
  });
}

// App.tsx
import { useEffect } from 'react';
import { initializeMockifyer } from './mockifyer-setup';

export default function App() {
  useEffect(() => {
    initializeMockifyer();
  }, []);
  
  // Your app code...
}

// services/subscription.ts
import { getCurrentDate } from '@sgedda/mockifyer-core';

export function getSubscriptionStatus() {
  const currentDate = getCurrentDate(); // Uses manipulated date
  
  // Your business logic using currentDate
  return {
    currentDate: currentDate.toISOString(),
    // ... other fields
  };
}
```

## Summary

### What Works

- ✅ **Date manipulation works in React Native** via `getCurrentDate()`
- ✅ **Sinon is optional** - gracefully falls back if unavailable
- ✅ **Use `getCurrentDate()`** for manipulated dates (required in React Native)
- ✅ **Works in Node.js tests** - Sinon available in Jest/test environments
- ✅ **No special configuration** - works out of the box

### Limitations

- ❌ **Sinon fake timers DON'T work in React Native** - Can't manipulate global `Date`
- ⚠️ **Must use `getCurrentDate()`** - `new Date()` returns real date in React Native
- ⚠️ **Only affects code using `getCurrentDate()`** - Other code sees real dates

### The Trade-off

**Node.js/Test Environment:**
- ✅ Sinon manipulates global `Date` → All `new Date()` calls use manipulated time
- ✅ More powerful - affects everything automatically

**React Native Production:**
- ✅ Fallback method works → `getCurrentDate()` returns manipulated dates
- ⚠️ Requires explicit use of `getCurrentDate()` instead of `new Date()`
- ⚠️ Only affects code that calls `getCurrentDate()`

The implementation is designed to be **React Native-friendly** while still providing date manipulation capabilities, but with the limitation that you must explicitly use `getCurrentDate()` in React Native apps.

