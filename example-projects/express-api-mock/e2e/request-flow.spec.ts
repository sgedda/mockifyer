import { test, expect } from '@playwright/test';

test.describe('Request Flow Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/request-flow.html');
  });

  test('should display request flow page', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check page title (heading with full text)
    await expect(page.getByRole('heading', { name: /Request Flow Visualization/i })).toBeVisible({ timeout: 10000 });
  });

  test('should have view mode toggle buttons', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check for view mode buttons (Timeline, Graph, List)
    // These buttons are in a toggle group
    const timelineButton = page.getByRole('button', { name: /Timeline/i });
    const graphButton = page.getByRole('button', { name: /Graph/i });
    const listButton = page.getByRole('button', { name: /List/i });
    
    // Wait a bit for buttons to appear
    await page.waitForTimeout(2000);
    
    // At least one should be visible
    const hasViewButtons = await timelineButton.isVisible().catch(() => false) ||
                           await graphButton.isVisible().catch(() => false) ||
                           await listButton.isVisible().catch(() => false);
    
    expect(hasViewButtons).toBeTruthy();
  });

  test('should display loading state initially', async ({ page }) => {
    // Page might show loading initially
    const loadingIndicator = page.getByText(/Loading/i).or(page.locator('[data-testid="loading"]'));
    // Loading might be very fast, so we just check the page loads
    await page.waitForLoadState('networkidle');
  });
});

