import { test, expect } from '@playwright/test';

test.describe('Introduction Page', () => {
  test('should display main content', async ({ page }) => {
    await page.goto('/');
    
    // Check main heading (in main content area, not nav)
    await expect(page.getByRole('main').getByText(/Mockifyer/i).first()).toBeVisible();
    
    // Check description
    await expect(page.getByText(/powerful Node\.js library/i)).toBeVisible();
    
    // Check key benefits section
    await expect(page.getByRole('heading', { name: /What is Mockifyer\?/i })).toBeVisible();
    await expect(page.getByText(/No more API rate limits/i)).toBeVisible();
    await expect(page.getByText(/Faster tests/i)).toBeVisible();
    await expect(page.getByText(/Deterministic testing:/i).first()).toBeVisible();
  });

  test('should have working links to other pages', async ({ page }) => {
    await page.goto('/');
    
    // Check Playground link
    const playgroundLink = page.getByRole('link', { name: /Explore Playground/i });
    await expect(playgroundLink).toBeVisible();
    await playgroundLink.click();
    await expect(page).toHaveURL(/.*playground\.html/);
    
    // Go back and check other links
    await page.goto('/');
    const gettingStartedLink = page.getByRole('link', { name: /Get Started Guide/i });
    await expect(gettingStartedLink).toBeVisible();
  });

  test('should display logo prominently', async ({ page }) => {
    await page.goto('/');
    
    // Logo should be visible and clickable (in main content area)
    const logo = page.getByRole('main').getByRole('link', { name: /mockifyer/i });
    await expect(logo).toBeVisible();
    
    // Check logo has network icon (visual check)
    const logoIcon = logo.locator('svg');
    await expect(logoIcon).toBeVisible();
  });
});

