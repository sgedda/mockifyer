import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('should display settings page with tabs', async ({ page }) => {
    // Check page title (heading, not link)
    await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible();
    
    // Check for tabs
    await expect(page.getByRole('tab', { name: /Date Configuration/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Config Reference/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Runtime Settings/i })).toBeVisible();
  });

  test('should show Date Configuration tab by default', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Date Configuration should be active
    const dateTab = page.getByRole('tab', { name: /Date Configuration/i });
    await expect(dateTab).toHaveAttribute('aria-selected', 'true');
    
    // Check for date configuration label text (not necessarily a label element)
    await expect(page.getByText(/Fixed Date \(ISO format\)/i)).toBeVisible({ timeout: 10000 });
  });

  test('should switch to Config Reference tab', async ({ page }) => {
    const configTab = page.getByRole('tab', { name: /Config Reference/i });
    await configTab.click();
    
    await expect(configTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/setupMockifyer/i)).toBeVisible({ timeout: 5000 });
  });

  test('should switch to Runtime Settings tab', async ({ page }) => {
    const runtimeTab = page.getByRole('tab', { name: /Runtime Settings/i });
    await runtimeTab.click();
    
    await expect(runtimeTab).toHaveAttribute('aria-selected', 'true');
    // Check for runtime settings content (use first() to handle multiple matches)
    await expect(page.getByText(/Mockifyer Enabled/i).first()).toBeVisible({ timeout: 5000 });
  });
});

