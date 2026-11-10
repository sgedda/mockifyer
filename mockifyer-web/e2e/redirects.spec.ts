import { test, expect } from '@playwright/test';

test.describe('Redirects', () => {
  test('should redirect /playground to home', async ({ page }) => {
    await page.goto('/playground');
    await expect(page).toHaveURL('/');
  });

  test('should redirect /timeline to home', async ({ page }) => {
    await page.goto('/timeline');
    await expect(page).toHaveURL('/');
  });

  test('should redirect /settings to home', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL('/');
  });
});
