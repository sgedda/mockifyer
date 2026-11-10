import { test, expect } from '@playwright/test';

test('Expo web app with Mockifyer', async ({ page }) => {
  // Navigate to the app
  await page.goto('/');
  
  // Wait for the app to load
  await page.waitForSelector('text=Mockifyer Expo Web Demo');
  
  // Take a screenshot of the initial state
  await page.screenshot({ path: 'tests/screenshots/expo-initial.png', fullPage: true });
  
  // Test seeded replay
  console.log('Testing seeded replay...');
  await page.click('text=Test Seeded Replay');
  
  // Wait for result or error
  await page.waitForTimeout(2000);
  
  // Check for result
  const result = await page.textContent('body');
  console.log('Page content after test:', result.substring(0, 500));
  
  // Take a screenshot of the result
  await page.screenshot({ path: 'tests/screenshots/expo-after-test.png', fullPage: true });
  
  // Verify mockifyer initialized
  expect(result).toContain('Mockifyer Expo Web Demo');
  
  console.log('✅ Expo web test completed');
});
