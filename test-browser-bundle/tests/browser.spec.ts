import { test, expect } from '@playwright/test';

test('mockifyer-fetch with memory provider should work in browser', async ({ page }) => {
  const consoleLogs: string[] = [];
  const consoleErrors: string[] = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    } else {
      consoleLogs.push(text);
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(error.message);
  });

  await page.goto('/');
  
  // Wait for test to complete
  await page.waitForFunction(() => (window as any).mockifyerTestResult !== undefined, { timeout: 5000 });
  
  const result = await page.evaluate(() => (window as any).mockifyerTestResult);
  
  console.log('Console logs:', consoleLogs);
  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
  }
  
  expect(result.success).toBe(true);
  expect(consoleErrors.length).toBe(0);
});
