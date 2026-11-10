import { test, expect } from '@playwright/test';

test('Expo web app with Mockifyer', async ({ page }) => {
  // Block all external network requests to ensure mocks are used
  await page.route('**/*', (route) => {
    const url = route.request().url();
    // Allow localhost (the test server)
    if (url.startsWith('http://localhost:') || url.startsWith('http://127.0.0.1:')) {
      return route.continue();
    }
    // Block all external requests
    console.log('[Test] Blocking external request:', url);
    return route.abort();
  });
  
  // Navigate to the app
  await page.goto('/');
  
  // Wait for the app to load
  await page.waitForSelector('text=Mockifyer Expo Web Demo');
  
  // Take a screenshot of the initial state
  await page.screenshot({ path: 'tests/screenshots/expo-initial.png', fullPage: true });
  
  // Test seeded replay
  console.log('Testing seeded replay...');
  await page.click('text=Test Seeded Replay');
  
  // Wait for result to appear
  await page.waitForTimeout(2000);
  
  // Check for result
  const bodyText = await page.textContent('body');
  console.log('Page content after test:', bodyText.substring(0, 500));
  
  // Take a screenshot of the result
  await page.screenshot({ path: 'tests/screenshots/expo-after-test.png', fullPage: true });
  
  // Verify mockifyer initialized and returned mock data
  expect(bodyText).toContain('Mockifyer Expo Web Demo');
  
  // Verify the fixture data is displayed (USD base, not EUR from real API)
  expect(bodyText).toContain('"base": "USD"');
  expect(bodyText).toContain('"date": "2024-01-15"');
  
  console.log('✅ Expo web test passed - seeded replay working with USD base from fixture');
});
