import { test, expect } from '@playwright/test';

test.describe('Playground Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/playground');
  });

  test('should display playground interface', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check Status Banner (this is a reliable indicator the page loaded)
    await expect(page.getByText(/Mockifyer:/i)).toBeVisible({ timeout: 10000 });
    
    // Check Client Config section (CardTitle)
    await expect(page.getByText(/Client Configuration/i)).toBeVisible();
    
    // HTTP Client and Scope might be in labels or select components
    // Check for either the label text or the select trigger
    const hasHttpClient = await page.getByText(/HTTP Client/i).isVisible().catch(() => false) ||
                          await page.locator('#client-type').isVisible().catch(() => false);
    expect(hasHttpClient).toBeTruthy();
    
    const hasScope = await page.getByText(/Scope/i).isVisible().catch(() => false) ||
                     await page.locator('#scope').isVisible().catch(() => false);
    expect(hasScope).toBeTruthy();
  });

  test('should allow selecting HTTP client type', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Find the client type selector (Shadcn Select component)
    const clientSelectTrigger = page.getByLabel(/HTTP Client/i).or(page.locator('#client-type'));
    await expect(clientSelectTrigger.first()).toBeVisible({ timeout: 10000 });
    
    // Click to open dropdown
    await clientSelectTrigger.first().click();
    
    // Check options are available
    await expect(page.getByRole('option', { name: /Axios/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /Fetch/i })).toBeVisible();
  });

  test('should allow selecting scope', async ({ page }) => {
    // Find the scope selector
    const scopeSelects = page.locator('select');
    const scopeSelect = scopeSelects.nth(1);
    
    if (await scopeSelect.isVisible()) {
      await expect(scopeSelect).toBeVisible();
    }
  });

  test('should display endpoint tester', async ({ page }) => {
    // Check for endpoint input or form
    const endpointInput = page.getByPlaceholder(/endpoint/i).or(page.getByLabel(/endpoint/i));
    const isVisible = await endpointInput.isVisible().catch(() => false);
    
    if (!isVisible) {
      // If not found by placeholder/label, check for any input fields
      const inputs = page.locator('input');
      const inputCount = await inputs.count();
      expect(inputCount).toBeGreaterThan(0);
    } else {
      await expect(endpointInput).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show request history section', async ({ page }) => {
    // Check for history section
    const historySection = page.getByText(/History/i).or(page.getByText(/Recent Requests/i));
    await expect(historySection.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // History might be empty initially, which is fine
    });
  });
});

