import { test, expect } from '@playwright/test';

test.describe('Comparisons Hub Page', () => {
  test('should include Keploy section', async ({ page }) => {
    await page.goto('/comparisons');
    
    // Should have Keploy card (use exact text to avoid multiple matches)
    await expect(page.getByRole('heading', { name: 'Keploy', exact: true })).toBeVisible();
    
    // Should have Keploy description mentioning eBPF
    await expect(page.getByText(/eBPF-based record and replay/i)).toBeVisible();
    await expect(page.getByText(/network traffic at the kernel level/i)).toBeVisible();
    
    // Should have "When to choose Keploy" text
    await expect(page.getByText(/backend integration testing with eBPF-level capture/i)).toBeVisible();
    
    // Should have GitHub link
    const keploGithubLink = page.getByRole('link', { name: /View Keploy on GitHub/i });
    await expect(keploGithubLink).toBeVisible();
    await expect(keploGithubLink).toHaveAttribute('href', 'https://github.com/keploy/keploy');
  });
  
  test('should have Keploy in feature matrix', async ({ page }) => {
    await page.goto('/comparisons');
    
    // Feature matrix should have Keploy column
    await expect(page.getByRole('columnheader', { name: /Keploy/i })).toBeVisible();
    
    // Check for specific Keploy values in the matrix
    // Should show eBPF kernel-level for recording
    await expect(page.getByText(/eBPF kernel-level/i)).toBeVisible();
    
    // Should show YAML testcases for JSON recordings
    await expect(page.getByText(/YAML testcases/i)).toBeVisible();
  });
  
  test('should mention Keploy in summary text', async ({ page }) => {
    await page.goto('/comparisons');
    
    // Should mention Keploy in the "When to Choose Mockifyer" section
    await expect(page.getByText(/For backend.*integration testing with eBPF-level capture.*Keploy/i)).toBeVisible();
  });
  
  test('should show all comparison pages', async ({ page }) => {
    await page.goto('/comparisons');
    
    // The "Detailed Comparisons" section should be visible
    const detailedComparisonsHeading = page.getByRole('heading', { name: /Detailed Comparisons/i });
    await expect(detailedComparisonsHeading).toBeVisible();
    
    // Should have 5 comparison links (msw, pollyjs, nock, wiremock, mockoon)
    const comparisonLinks = page.locator('a[href^="/comparisons/"]');
    await expect(comparisonLinks).toHaveCount(5);
  });
  
  test('should keep existing content intact', async ({ page }) => {
    await page.goto('/comparisons');
    
    // Original content should still be present
    await expect(page.getByRole('heading', { name: /Mockifyer vs Alternatives/i })).toBeVisible();
    await expect(page.getByText(/The Problem Mockifyer Solves/i)).toBeVisible();
    await expect(page.getByText(/Feature Comparison/i)).toBeVisible();
    
    // Original tools should still be present (use headings with exact names to avoid multiple matches)
    await expect(page.getByRole('heading', { name: 'MSW (Mock Service Worker)', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Polly.js', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nock', exact: true })).toBeVisible();
  });
  
  test('should return 200 status', async ({ page }) => {
    const response = await page.goto('/comparisons');
    expect(response?.status()).toBe(200);
  });
});
