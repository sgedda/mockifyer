import { test, expect } from '@playwright/test';

test.describe('Introduction Page', () => {
  test('should display main content', async ({ page }) => {
    await page.goto('/');
    
    // Check hero subtitle
    await expect(page.getByText(/Record live API responses.*replay them instantly in tests/i)).toBeVisible();
    
    // Check problems section with new cards
    await expect(page.getByText(/API isn't ready yet/i)).toBeVisible();
    await expect(page.getByText(/Hard-to-reproduce states/i)).toBeVisible();
    await expect(page.getByText(/E2E tests flake/i)).toBeVisible();
    await expect(page.getByText(/Trace requests across services/i)).toBeVisible();
    await expect(page.getByText(/Replicate requests with curl/i)).toBeVisible();

    // How it works section
    await expect(page.getByRole('heading', { name: /How It Works/i })).toBeVisible();
    await expect(page.getByText(/Record/i)).toBeVisible();
    await expect(page.getByText(/Replay/i)).toBeVisible();
    await expect(page.getByText(/Scenarios/i)).toBeVisible();
  });

  test('should display showcase videos', async ({ page }) => {
    await page.goto('/');
    
    // Check main autoplay video
    const mainVideo = page.locator('video[autoplay]').first();
    await expect(mainVideo).toBeVisible();
    
    // Check hover videos with posters
    const hoverVideos = page.locator('video[poster]');
    expect(await hoverVideos.count()).toBeGreaterThanOrEqual(2);
  });

  test('should have working links to other pages', async ({ page }) => {
    await page.goto('/');
    
    // Check E2E Tutorial link
    const tutorialLink = page.getByRole('link', { name: /E2E Tutorial/i }).first();
    await expect(tutorialLink).toBeVisible();
    
    // Check Browse Packages link
    const packagesLink = page.getByRole('link', { name: /Browse Packages/i }).first();
    await expect(packagesLink).toBeVisible();
  });

  test('should have Try it Live demo button', async ({ page }) => {
    await page.goto('/');
    
    // Check for RunItButton
    const demoButton = page.getByRole('button', { name: /Run Demo in StackBlitz/i });
    await expect(demoButton).toBeVisible();
  });

  test('should display use cases', async ({ page }) => {
    await page.goto('/');
    
    // Check use cases section
    await expect(page.getByRole('heading', { name: /Use Cases/i })).toBeVisible();
    await expect(page.getByText(/React Native Development/i)).toBeVisible();
    await expect(page.getByText(/Integration Testing/i)).toBeVisible();
  });
});

