import { test, expect } from '@playwright/test';

test('browser bundle with seeded replay (NO Node built-ins)', async ({ page }) => {
  const consoleLogs: string[] = [];
  const consoleErrors: string[] = [];
  
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(error.message);
  });

  await page.goto('/');
  
  // Wait for tests to complete (generous timeout for slow builds)
  await page.waitForFunction(
    () => (window as any).mockifyerTestResult !== undefined, 
    { timeout: 10000 }
  );
  
  const result = await page.evaluate(() => (window as any).mockifyerTestResult);
  
  console.log('\n=== Console Logs ===');
  consoleLogs.forEach(log => console.log(log));
  
  if (consoleErrors.length > 0) {
    console.error('\n=== Console Errors ===');
    consoleErrors.forEach(err => console.error(err));
  }
  
  console.log('\n=== Test Result ===');
  console.log(JSON.stringify(result, null, 2));
  
  // Assertions
  expect(result.success).toBe(true);
  expect(result.tests?.seededReplay).toBe(true);
  expect(result.tests?.clearErrorOnMiss).toBe(true);
  
  // No unexpected errors (expected errors from missing mock test are caught)
  const unexpectedErrors = consoleErrors.filter(
    err => !err.includes('No mock found') && !err.includes('Request key:')
  );
  expect(unexpectedErrors.length).toBe(0);
});
