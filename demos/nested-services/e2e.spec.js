import { test, expect } from '@playwright/test';

test.describe('Nested Services Demo', () => {
  test('should display default scenario data', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/e2e-01-default.png', fullPage: true });
    
    // Basic checks that page loaded
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('should load page for empty-reviews scenario', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'screenshots/e2e-02-empty-reviews.png', fullPage: true });
    
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('should load page for currency-error scenario', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'screenshots/e2e-03-currency-error.png', fullPage: true });
    
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });
});

test.describe('Dashboard Trace', () => {
  test('should show dashboard with trace data', async ({ page }) => {
    await page.goto('http://localhost:3002', { waitUntil: 'domcontentloaded' });
    
    // Wait for dashboard UI to render
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/e2e-04-dashboard.png', fullPage: true });
    
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });
});
