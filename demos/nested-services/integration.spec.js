import { test, expect } from '@playwright/test';

test.describe('Integration: Gateway + Frontend + Dashboard', () => {
  test('should run all services and handle requests correctly', async ({ page }) => {
    // Go to frontend (Vite on 5173)
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Test 1: Default scenario
    await page.fill('#cityInput', 'London');
    await page.selectOption('#scenarioSelect', 'default');
    await page.click('button:has-text("Get Trip Info")');
    await page.waitForTimeout(2000);
    
    const defaultContent = await page.content();
    expect(defaultContent).toContain('London');
    expect(defaultContent).toContain('13');  // Temperature
    expect(defaultContent).toContain('3');   // 3 reviews
    // Verify it's showing data, not an error about JSON parsing
    expect(defaultContent).not.toContain('Unexpected token');
    expect(defaultContent).not.toContain('is not valid JSON');
    
    // Test 2: Empty reviews scenario
    await page.selectOption('#scenarioSelect', 'empty-reviews');
    await page.click('button:has-text("Get Trip Info")');
    await page.waitForTimeout(2000);
    
    const emptyContent = await page.content();
    expect(emptyContent).toContain('0');  // 0 reviews
    
    // Test 3: Currency error scenario
    await page.selectOption('#scenarioSelect', 'currency-error');
    await page.click('button:has-text("Get Trip Info")');
    await page.waitForTimeout(2000);
    
    const errorContent = await page.content();
    expect(errorContent).toContain('Error');
  });

  test('should have working Explore links', async ({ page, context }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Fetch some data first
    await page.fill('#cityInput', 'London');
    await page.click('button:has-text("Get Trip Info")');
    await page.waitForTimeout(2000);
    
    // Test dashboard link
    const dashboardLink = await page.locator('#dashboardLink').getAttribute('href');
    expect(dashboardLink).toBeTruthy();
    expect(dashboardLink).not.toBe('#');
    
    // Verify dashboard is accessible (HTTP 200)
    const dashboardResponse = await page.request.get(dashboardLink);
    expect(dashboardResponse.status()).toBe(200);
    const dashboardText = await dashboardResponse.text();
    expect(dashboardText).not.toContain('<!DOCTYPE html><html'); // Should be dashboard, not index.html
    
    // Test trace link
    const traceLink = await page.locator('#traceLink').getAttribute('href');
    expect(traceLink).toBeTruthy();
    expect(traceLink).toContain('network-events');
    
    const traceResponse = await page.request.get(traceLink.split('#')[0]); // Just check base URL
    expect(traceResponse.status()).toBe(200);
    
    // Test mocks link
    const mocksLink = await page.locator('#mocksLink').getAttribute('href');
    expect(mocksLink).toBeTruthy();
    expect(mocksLink).toContain('mocks');
    
    const mocksResponse = await page.request.get(mocksLink.split('#')[0]); // Just check base URL
    expect(mocksResponse.status()).toBe(200);
  });

  test('should proxy API requests through Vite', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Make a direct API call using the same origin (should be proxied)
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/trip/London?scenario=default');
      return {
        status: res.status,
        ok: res.ok,
        data: await res.json()
      };
    });
    
    expect(response.status).toBe(200);
    expect(response.ok).toBe(true);
    expect(response.data).toHaveProperty('city', 'London');
    expect(response.data).toHaveProperty('weather');
    expect(response.data).toHaveProperty('reviews');
    expect(response.data).toHaveProperty('currency');
  });
});
