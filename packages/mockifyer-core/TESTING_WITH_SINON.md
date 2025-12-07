# Testing with Sinon and Mockifyer

Mockifyer handles API mocking, while Sinon provides powerful spying, stubbing, and mocking capabilities for functions and methods. Together, they provide a comprehensive testing solution.

## Why Use Sinon?

Mockifyer is excellent for mocking external APIs, but what about testing your internal code? That's where Sinon comes in.

**Common testing scenarios where Sinon helps:**

- **Verify function calls:** Did your function call another function with the right arguments?
- **Prevent side effects:** Stop functions from sending emails, writing files, or making network calls during tests
- **Control behavior:** Make functions return specific values or throw errors for testing edge cases
- **Test interactions:** Verify that multiple functions were called in the correct order
- **Mock dependencies:** Replace third-party libraries or modules with test doubles

**Example scenario:** Your code fetches user data from an API (Mockifyer mocks this), then processes it and sends a notification email. You want to verify the email function was called, but you don't want to actually send emails during tests. Sinon lets you spy on the email function and verify it was called correctly.

**Without Sinon:** You'd have to manually track function calls, create wrapper functions, or accept side effects in your tests.

**With Sinon:** One line of code to spy on a function, verify calls, and prevent side effects.

## When Sinon Works

**Sinon works in:**
- ✅ **Node.js environments** - Backend services, Express APIs, CLI tools
- ✅ **Test environments** - Jest, Mocha, Vitest running in Node.js
- ✅ **Development servers** - Any Node.js-based development environment

**Sinon does NOT work in:**
- ❌ **React Native** - Sinon relies on Node.js built-in modules (like `assert`) that aren't available in React Native
- ❌ **Browser production builds** - Limited runtime capabilities
- ❌ **Mobile app runtimes** - Hermes/JSC don't support Sinon's requirements

**Important:** Mockifyer works everywhere (including React Native), but Sinon is Node.js-only. For React Native testing:
- Use **Mockifyer** for API mocking ✅
- Use **Jest's built-in mocking** (`jest.fn()`, `jest.spyOn()`) for function spying/stubbing ✅
- Do NOT use Sinon in React Native ❌

## When to Use Sinon with Mockifyer

**Mockifyer is for:**
- ✅ Mocking HTTP requests/responses (API calls)
- ✅ Recording and replaying API responses
- ✅ Date manipulation for time-dependent tests

**Sinon is for:**
- ✅ Spying on function calls
- ✅ Stubbing methods and functions
- ✅ Mocking objects and modules
- ✅ Verifying function call counts and arguments
- ✅ Controlling function behavior (return values, throwing errors)

## Installation

```bash
npm install --save-dev sinon @types/sinon
```

## Basic Usage

### Example: Spying on Functions Called by API Responses

```typescript
import sinon from 'sinon';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

describe('User Service', () => {
  let mockifyer: any;
  let processUserSpy: sinon.SinonSpy;

  beforeEach(() => {
    // Setup Mockifyer for API mocking
    mockifyer = setupMockifyer({
      mockDataPath: './mock-data',
      recordMode: false,
    });

    // Use Sinon to spy on a function
    processUserSpy = sinon.spy(userService, 'processUser');
  });

  afterEach(() => {
    // Restore Sinon spies/stubs
    sinon.restore();
    mockifyer.reset();
  });

  it('should process user data from API response', async () => {
    // Mockifyer handles the API call
    const response = await fetch('https://api.example.com/users/1');
    const userData = await response.json();

    // Call the function that processes the data
    userService.processUser(userData);

    // Use Sinon to verify the function was called correctly
    expect(processUserSpy.calledOnce).toBe(true);
    expect(processUserSpy.calledWith(userData)).toBe(true);
  });
});
```

### Example: Stubbing Methods with Mockifyer

```typescript
import sinon from 'sinon';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

describe('Order Processing', () => {
  let mockifyer: any;
  let emailServiceStub: sinon.SinonStub;

  beforeEach(() => {
    mockifyer = setupMockifyer({
      mockDataPath: './mock-data',
      recordMode: false,
    });

    // Stub the email service to prevent actual emails
    emailServiceStub = sinon.stub(emailService, 'sendEmail').resolves(true);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should send email after successful order', async () => {
    // Mockifyer mocks the API call
    const orderResponse = await fetch('https://api.example.com/orders', {
      method: 'POST',
      body: JSON.stringify({ items: [...] }),
    });

    // Sinon stub prevents actual email sending
    await orderService.processOrder(await orderResponse.json());

    // Verify email was "sent" (stubbed)
    expect(emailServiceStub.calledOnce).toBe(true);
  });
});
```

### Example: Combining Date Manipulation with Sinon Spies

```typescript
import sinon from 'sinon';
import { setupMockifyer, getCurrentDate } from '@sgedda/mockifyer-core';

describe('Subscription Service', () => {
  let mockifyer: any;
  let notifyUserSpy: sinon.SinonSpy;

  beforeEach(() => {
    mockifyer = setupMockifyer({
      mockDataPath: './mock-data',
      dateManipulation: {
        fixedDate: '2024-12-25T00:00:00.000Z', // Christmas
      },
    });

    notifyUserSpy = sinon.spy(notificationService, 'notifyUser');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should notify user when subscription expires', async () => {
    // Mockifyer handles date manipulation
    const currentDate = getCurrentDate(); // Returns fixed date

    // Mockifyer handles API call
    const subscription = await fetch('https://api.example.com/subscription/1');

    // Check if subscription is expired using manipulated date
    if (subscription.expiresAt < currentDate) {
      notificationService.notifyUser('subscription_expired');
    }

    // Verify notification was sent
    expect(notifyUserSpy.calledWith('subscription_expired')).toBe(true);
  });
});
```

## Advanced Patterns

### Mocking External Modules

```typescript
import sinon from 'sinon';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

describe('Payment Processing', () => {
  let mockifyer: any;
  let paymentGatewayMock: sinon.SinonStub;

  beforeEach(() => {
    mockifyer = setupMockifyer({
      mockDataPath: './mock-data',
      recordMode: false,
    });

    // Mock an external payment gateway module
    paymentGatewayMock = sinon.stub(paymentGateway, 'charge').resolves({
      success: true,
      transactionId: 'tx_123',
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should process payment after API call', async () => {
    // Mockifyer mocks the order API
    const order = await fetch('https://api.example.com/orders/1');

    // Sinon mocks the payment gateway
    const paymentResult = await paymentGateway.charge(order.total);

    expect(paymentResult.success).toBe(true);
    expect(paymentGatewayMock.calledOnce).toBe(true);
  });
});
```

### Verifying Call Order

```typescript
import sinon from 'sinon';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

describe('Data Synchronization', () => {
  let mockifyer: any;
  let fetchSpy: sinon.SinonSpy;
  let processSpy: sinon.SinonSpy;
  let saveSpy: sinon.SinonSpy;

  beforeEach(() => {
    mockifyer = setupMockifyer({
      mockDataPath: './mock-data',
      recordMode: false,
    });

    fetchSpy = sinon.spy(dataService, 'fetchData');
    processSpy = sinon.spy(dataService, 'processData');
    saveSpy = sinon.spy(dataService, 'saveData');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should call methods in correct order', async () => {
    await dataService.sync();

    // Verify call order using Sinon
    sinon.assert.callOrder(fetchSpy, processSpy, saveSpy);
  });
});
```

## Best Practices

1. **Use Mockifyer for HTTP**: Let Mockifyer handle all API mocking
2. **Use Sinon for Functions**: Use Sinon for spying/stubbing internal functions
3. **Clean Up**: Always restore Sinon spies/stubs in `afterEach`
4. **Separate Concerns**: Mockifyer = external APIs, Sinon = internal code
5. **Combine When Needed**: Use both together for comprehensive test coverage

## Common Patterns

### Pattern 1: API Mocking + Function Spying
```typescript
// Mockifyer: Mock API calls
// Sinon: Spy on functions that use API data
```

### Pattern 2: Date Manipulation + Function Verification
```typescript
// Mockifyer: Manipulate dates
// Sinon: Verify time-dependent function behavior
```

### Pattern 3: External Service Mocking
```typescript
// Mockifyer: Mock your API
// Sinon: Mock third-party libraries/services
```

## React Native Alternative

Since Sinon doesn't work in React Native, use Jest's built-in mocking instead:

```typescript
// React Native - Use Jest instead of Sinon
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

describe('User Service', () => {
  let mockifyer: any;
  let processUserSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mockifyer handles API mocking (works in React Native!)
    mockifyer = setupMockifyer({
      mockDataPath: './mock-data',
      recordMode: false,
    });

    // Jest spies on internal functions (works in React Native!)
    processUserSpy = jest.spyOn(userService, 'processUser');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should process user data from API response', async () => {
    // Mockifyer mocks the API call
    const response = await fetch('https://api.example.com/users/1');
    const userData = await response.json();

    // Call the function
    userService.processUser(userData);

    // Jest verifies the function was called
    expect(processUserSpy).toHaveBeenCalledTimes(1);
    expect(processUserSpy).toHaveBeenCalledWith(userData);
  });
});
```

**Jest equivalents for Sinon:**
- `sinon.spy()` → `jest.spyOn()` or `jest.fn()`
- `sinon.stub()` → `jest.spyOn().mockImplementation()` or `jest.fn()`
- `sinon.mock()` → `jest.mock()`
- `spy.calledOnce` → `expect(spy).toHaveBeenCalledTimes(1)`
- `spy.calledWith(...)` → `expect(spy).toHaveBeenCalledWith(...)`

## Summary

- **Mockifyer**: Handles HTTP/API mocking and date manipulation (works everywhere!)
- **Sinon**: Handles function spying, stubbing, and method mocking (Node.js only)
- **Jest**: Built-in mocking for React Native (use instead of Sinon)
- **Together**: Comprehensive testing solution covering both external APIs and internal code

**Environment Guide:**
- **Node.js/Backend**: Mockifyer + Sinon ✅
- **React Native**: Mockifyer + Jest ✅
- **Browser**: Mockifyer + Jest ✅

Both tools complement each other perfectly - Mockifyer for external dependencies (APIs), Sinon/Jest for internal code behavior.

