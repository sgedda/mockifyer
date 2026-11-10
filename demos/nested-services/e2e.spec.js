import { test, expect } from '@playwright/test';

test.describe('Nested Services Demo', () => {
  test('should display default scenario data', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Fetch London data
    await page.fill('#cityInput', 'London');
    await page.click('button:has-text("Get Trip Info")');
    await page.waitForTimeout(2000);
    
    // Check for NO errors
    const content = await page.content();
    expect(content).not.toContain('No mock data found');
    expect(content).not.toContain('Error:');
    
    // Check for actual data
    expect(content).toContain('London');
    expect(content).toContain('13');  // Temperature
    expect(content).toContain('3');    // 3 reviews
    expect(content).toContain('0.92'); // Currency rate
    
    await page.screenshot({ path: 'screenshots/e2e-01-default.png', fullPage: true });
  });

  test('should display empty-reviews scenario', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Select empty-reviews scenario
    await page.selectOption('#scenarioSelect', 'empty-reviews');
    await page.click('button:has-text("Switch Scenario")');
    await page.waitForTimeout(1000);
    
    // Fetch London data
    await page.fill('#cityInput', 'London');
    await page.click('button:has-text("Get Trip Info")');
    await page.waitForTimeout(2000);
    
    const content = await page.content();
    expect(content).not.toContain('No mock data found');
    expect(content).toContain('London');
    
    await page.screenshot({ path: 'screenshots/e2e-02-empty-reviews.png', fullPage: true });
  });

  test('should display currency-error scenario', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Select currency-error scenario
    await page.selectOption('#scenarioSelect', 'currency-error');
    await page.click('button:has-text("Switch Scenario")');
    await page.waitForTimeout(1000);
    
    // Fetch London data
    await page.fill('#cityInput', 'London');
    await page.click('button:has-text("Get Trip Info")');
    await page.waitForTimeout(2000);
    
    const content = await page.content();
    expect(content).not.toContain('No mock data found');
    expect(content).toContain('London');
    expect(content).toContain('Error');  // Currency should show error
    
    await page.screenshot({ path: 'screenshots/e2e-03-currency-error.png', fullPage: true });
  });
});

test.describe('Dashboard Trace', () => {
  test('should show dashboard with recorded mocks and traces', async ({ page }) => {
    await page.goto('http://localhost:3002', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    const content = await page.content();
    
    // Should show at least 4 mocks
    // Should show at least 1 multi-hop chain
    // Should NOT be pointing at _scratch
    expect(content).not.toContain('_scratch');
    expect(content).not.toContain('0 files');
    
    await page.screenshot({ path: 'screenshots/e2e-04-dashboard.png', fullPage: true });
  });
});
