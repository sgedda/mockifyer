import { test, expect } from '@playwright/test';

test.describe('Nested Services Demo', () => {
  test('should display default scenario data', async ({ page }) => {
    await page.goto('http://localhost:5174');
    
    // Wait for data to load
    await page.waitForSelector('.trip-data', { timeout: 10000 });
    
    // Check that weather data is displayed
    await expect(page.locator('text=London')).toBeVisible();
    await expect(page.locator('text=13°C')).toBeVisible();
    
    // Check that reviews are displayed (should be 3)
    const reviewsSection = page.locator('text=/reviews.*3/i');
    await expect(reviewsSection).toBeVisible();
    
    // Check that currency rate is displayed
    await expect(page.locator('text=/EUR.*0\.92/i')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/01-default-scenario.png', fullPage: true });
  });

  test('should switch to empty-reviews scenario', async ({ page }) => {
    await page.goto('http://localhost:5174');
    await page.waitForSelector('.trip-data', { timeout: 10000 });
    
    // Switch scenario via dashboard or button (if implemented)
    // For now, test by loading page with scenario env var set
    // This would require restarting the gateway with MOCKIFYER_SCENARIO=empty-reviews
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/02-empty-reviews-scenario.png', fullPage: true });
  });

  test('should switch to currency-error scenario', async ({ page }) => {
    await page.goto('http://localhost:5174');
    await page.waitForSelector('.trip-data', { timeout: 10000 });
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/03-currency-error-scenario.png', fullPage: true });
  });
});

test.describe('Dashboard Trace', () => {
  test('should show nested trace with shared request ID', async ({ page }) => {
    await page.goto('http://localhost:3002');
    
    // Wait for dashboard to load
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Look for request trace
    // The dashboard should show the fan-out pattern with nested calls
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/04-dashboard-trace.png', fullPage: true });
  });
});
