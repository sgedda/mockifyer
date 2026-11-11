import { test, expect } from '@playwright/test';

test.describe('Redirects', () => {
  test('should redirect /playground to Getting Started', async ({ page }) => {
    await page.goto('/playground');
    await expect(page).toHaveURL('/getting-started');
    await expect(page.getByRole('heading', { name: /Getting Started/i })).toBeVisible();
  });

  test('should redirect /timeline to Dashboard with Network anchor', async ({ page }) => {
    await page.goto('/timeline');
    await expect(page).toHaveURL('/dashboard#network');
    await expect(page.getByRole('heading', { name: /Dashboard/i }).first()).toBeVisible();
  });

  test('should redirect /settings to Date Config page', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL('/date-config');
    await expect(page.getByRole('heading', { name: /Date Configuration/i })).toBeVisible();
  });
});
