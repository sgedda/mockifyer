import { test, expect } from '@playwright/test';

test.describe('Introduction Page', () => {
  test('should display main content', async ({ page }) => {
    await page.goto('/');
    
    // Check main heading
    await expect(page.getByRole('heading', { name: /Record real traffic.*Replay in tests/i })).toBeVisible();
    
    // Check hero tagline
    await expect(page.getByText(/No account, no cloud/i)).toBeVisible();
    
    // Check problems section
    await expect(page.getByRole('heading', { name: /The Problems Mockifyer Solves/i })).toBeVisible();
    await expect(page.getByText(/API Isn't Ready Yet/i)).toBeVisible();
    await expect(page.getByText(/Hard-to-Reproduce States/i)).toBeVisible();
    await expect(page.getByText(/E2E Tests Flake/i)).toBeVisible();

    // How it works section
    await expect(page.getByRole('heading', { name: /How It Works/i })).toBeVisible();
    await expect(page.getByText(/Record Real Traffic/i)).toBeVisible();
    await expect(page.getByText(/Organize into Scenarios/i)).toBeVisible();
  });

  test('should have working links to other pages', async ({ page }) => {
    await page.goto('/');
    
    // Check E2E Tutorial link
    const tutorialLink = page.getByRole('link', { name: /E2E Tutorial/i }).first();
    await expect(tutorialLink).toBeVisible();
    
    // Check Get Started link
    const gettingStartedLink = page.getByRole('link', { name: /Get Started/i }).first();
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

