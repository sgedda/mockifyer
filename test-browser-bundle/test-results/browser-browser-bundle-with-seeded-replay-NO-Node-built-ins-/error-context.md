# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browser.spec.ts >> browser bundle with seeded replay (NO Node built-ins)
- Location: tests/browser.spec.ts:3:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - heading "Mockifyer Browser Test" [level=1] [ref=e2]
  - generic [ref=e3]: ❌ Tests failed
  - generic [ref=e4]: Missing mock should have thrown an error
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('browser bundle with seeded replay (NO Node built-ins)', async ({ page }) => {
  4  |   const consoleLogs: string[] = [];
  5  |   const consoleErrors: string[] = [];
  6  |   
  7  |   page.on('console', msg => {
  8  |     const text = msg.text();
  9  |     consoleLogs.push(text);
  10 |     if (msg.type() === 'error') {
  11 |       consoleErrors.push(text);
  12 |     }
  13 |   });
  14 | 
  15 |   page.on('pageerror', error => {
  16 |     consoleErrors.push(error.message);
  17 |   });
  18 | 
  19 |   await page.goto('/');
  20 |   
  21 |   // Wait for tests to complete (generous timeout for slow builds)
  22 |   await page.waitForFunction(
  23 |     () => (window as any).mockifyerTestResult !== undefined, 
  24 |     { timeout: 10000 }
  25 |   );
  26 |   
  27 |   const result = await page.evaluate(() => (window as any).mockifyerTestResult);
  28 |   
  29 |   console.log('\n=== Console Logs ===');
  30 |   consoleLogs.forEach(log => console.log(log));
  31 |   
  32 |   if (consoleErrors.length > 0) {
  33 |     console.error('\n=== Console Errors ===');
  34 |     consoleErrors.forEach(err => console.error(err));
  35 |   }
  36 |   
  37 |   console.log('\n=== Test Result ===');
  38 |   console.log(JSON.stringify(result, null, 2));
  39 |   
  40 |   // Assertions
> 41 |   expect(result.success).toBe(true);
     |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  42 |   expect(result.tests?.seededReplay).toBe(true);
  43 |   expect(result.tests?.clearErrorOnMiss).toBe(true);
  44 |   
  45 |   // No unexpected errors (expected errors from missing mock test are caught)
  46 |   const unexpectedErrors = consoleErrors.filter(
  47 |     err => !err.includes('No mock found') && !err.includes('Request key:')
  48 |   );
  49 |   expect(unexpectedErrors.length).toBe(0);
  50 | });
  51 | 
```