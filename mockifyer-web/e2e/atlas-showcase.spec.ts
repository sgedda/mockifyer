import { test, expect } from '@playwright/test';

test.describe('WanderWeird Atlas static page', () => {
  test('serves interactive Atlas HTML with observed traffic', async ({ page }) => {
    const response = await page.goto('/atlas/wanderweird/');
    expect(response?.status()).toBe(200);

    const html = await response?.text();
    expect(html).toBeTruthy();
    expect(html!).toMatch(/Mockifyer Atlas/i);
    expect(html!).toMatch(/"totalRequests"\s*:\s*1205|"totalRequests"\s*:\s*[1-9]/);
    expect(html!).toMatch(/"observedEndpoints"\s*:\s*[1-9]/);
    expect(html!).toMatch(/color-scheme:\s*light|content="light"/);

    await expect(page.getByRole('heading', { name: /Mockifyer Atlas/i }).first()).toBeVisible();
  });

  test('/atlas/wanderweird redirects to trailing slash', async ({ request }) => {
    const response = await request.get('/atlas/wanderweird', { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toMatch(/\/atlas\/wanderweird\/?/);
  });
});
