import { test, expect } from '@playwright/test';

test.describe('Status API and Banner', () => {
  test('should fetch status API and verify version is not unknown', async ({ request }) => {
    // Test the API endpoint directly
    const response = await request.get('http://localhost:3000/api/status');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    console.log('[Status API Response]:', JSON.stringify(data, null, 2));
    
    // Verify the response structure
    expect(data).toHaveProperty('mockifyerVersion');
    expect(data).toHaveProperty('deployedDate');
    expect(data).toHaveProperty('githubRepo');
    
    // Check that version is not "unknown"
    console.log('[Mockifyer Version]:', data.mockifyerVersion);
    expect(data.mockifyerVersion).not.toBe('unknown');
    expect(data.mockifyerVersion).toBeTruthy();
  });

  test('should display version in status banner on playground page', async ({ page }) => {
    await page.goto('/playground');
    await page.waitForLoadState('networkidle');
    
    // Wait for status banner to load
    const statusBanner = page.getByText(/Mockifyer:/i);
    await expect(statusBanner).toBeVisible({ timeout: 10000 });
    
    // Check that version badge is visible and not "unknown"
    const versionBadge = page.locator('text=/Mockifyer:/i').locator('..').getByRole('status', { name: /unknown/i }).or(
      page.locator('text=/Mockifyer:/i').locator('..').locator('[class*="badge"]').filter({ hasText: /unknown/i })
    );
    
    // Try to find the version badge near "Mockifyer:"
    const mockifyerSection = page.locator('text=/Mockifyer:/i').locator('..');
    const badges = mockifyerSection.locator('[class*="badge"], [role="status"]');
    const badgeCount = await badges.count();
    
    console.log('[Found badges near Mockifyer]:', badgeCount);
    
    // Get all text content to see what's displayed
    const statusText = await mockifyerSection.textContent();
    console.log('[Status Banner Text]:', statusText);
    
    // Verify that "unknown" is not displayed
    const pageContent = await page.content();
    const hasUnknown = pageContent.includes('Mockifyer') && pageContent.includes('unknown');
    
    if (hasUnknown) {
      console.error('[ERROR] Version is showing as "unknown"');
      console.log('[Page Content Snippet]:', pageContent.substring(
        pageContent.indexOf('Mockifyer') - 100,
        pageContent.indexOf('Mockifyer') + 200
      ));
    }
    
    // The test will fail if unknown is found, but we want to see the debug info
    expect(hasUnknown).toBeFalsy();
  });

  test('should verify status API returns valid package versions', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/status');
    const data = await response.json();
    
    console.log('[Full Status Response]:', JSON.stringify(data, null, 2));
    
    // Check runtime config
    if (data.runtimeConfig) {
      console.log('[Runtime Config]:', JSON.stringify(data.runtimeConfig, null, 2));
    }
    
    // Verify version format (should contain version numbers)
    if (data.mockifyerVersion && data.mockifyerVersion !== 'unknown') {
      // Should contain version numbers like "core@1.6.1" or similar
      expect(data.mockifyerVersion).toMatch(/\d+\.\d+\.\d+/);
      console.log('[✓] Version found:', data.mockifyerVersion);
    } else {
      console.error('[✗] Version is unknown or missing');
      console.error('[Response]:', data);
      throw new Error(`Version is showing as "${data.mockifyerVersion}"`);
    }
  });
});

