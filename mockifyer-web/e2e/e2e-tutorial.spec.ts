import { test, expect } from '@playwright/test';

test.describe('E2E Tutorial Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e-tutorial');
  });

  test('should display main heading and overview', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Controlling a nested multi-service stack/i })).toBeVisible();
    await expect(page.getByText(/End-to-end walkthrough of the WanderWeird demo stack/i)).toBeVisible();
  });

  test('should display disclosure alert', async ({ page }) => {
    await expect(page.getByText(/Disclosure.*Mockifyer is my own open-source project/i)).toBeVisible();
  });

  test('should display branch note callout', async ({ page }) => {
    await expect(page.getByText(/Branch note.*PR #487/i)).toBeVisible();
    await expect(page.getByText(/cursor\/e2e-dashboard-gui-videos-7d37/i).first()).toBeVisible();
  });

  test('should display all major sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /What you'll build and see/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Prerequisites/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Clone and install/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Start the stack and run the tests/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Walkthrough.*one scenario per test/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /How to reproduce/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Conclusion/i })).toBeVisible();
  });

  test('should display stack components table', async ({ page }) => {
    await expect(page.getByText(/WanderWeird app.*Expo web via Metro/i)).toBeVisible();
    await expect(page.getByRole('cell', { name: 'gateway-api' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'wander-api', exact: true })).toBeVisible();
    await expect(page.getByText(/Mockifyer dashboard.*sqlite/i).first()).toBeVisible();
  });

  test('should have code blocks with installation commands', async ({ page }) => {
    const codeBlocks = page.locator('pre, code');
    const count = await codeBlocks.count();
    expect(count).toBeGreaterThan(5);
    
    await expect(page.getByText(/git clone.*mockifyer/i)).toBeVisible();
    await expect(page.getByText(/npx mockifyer-dashboard/i)).toBeVisible();
  });

  test('should display all nine walkthrough scenarios', async ({ page }) => {
    await expect(page.getByText(/5\.1.*Mock editor.*response body edit/i)).toBeVisible();
    await expect(page.getByText(/5\.2.*Overrides page.*field override/i)).toBeVisible();
    await expect(page.getByText(/5\.3.*Status override 503/i)).toBeVisible();
    await expect(page.getByText(/5\.4.*Settings.*client lane/i)).toBeVisible();
    await expect(page.getByText(/5\.5.*Header scenario picker/i)).toBeVisible();
    await expect(page.getByText(/5\.6.*Network view/i)).toBeVisible();
    await expect(page.getByText(/5\.7.*From scratch/i)).toBeVisible();
    await expect(page.getByText(/5\.8.*Tracing walkthrough/i)).toBeVisible();
    await expect(page.getByText(/5\.9.*Delay and status override/i)).toBeVisible();
  });

  test('should display key temperatures mentioned in scenarios', async ({ page }) => {
    await expect(page.getByText(/99°/i).first()).toBeVisible();
    await expect(page.getByText(/44°/i).first()).toBeVisible();
    await expect(page.getByText(/11°/i).first()).toBeVisible();
    await expect(page.getByText(/18°/i).first()).toBeVisible();
  });

  test('should display conclusion with key benefits', async ({ page }) => {
    await expect(page.getByText(/Per-endpoint control with no code changes/i)).toBeVisible();
    await expect(page.getByText(/Scenarios shared across services/i)).toBeVisible();
    await expect(page.getByText(/Surgical failure injection/i)).toBeVisible();
    await expect(page.getByText(/A trace across services/i)).toBeVisible();
    await expect(page.getByText(/Checked end to end/i)).toBeVisible();
  });

  test('should display limits section', async ({ page }) => {
    await expect(page.getByText(/Limits.*as of #487/i)).toBeVisible();
    await expect(page.getByText(/Atlas's live trace/i)).toBeVisible();
    await expect(page.getByText(/The tests drive the Expo.*web.*build/i)).toBeVisible();
  });

  test('should be accessible from navigation', async ({ page }) => {
    await page.goto('/');
    const navLink = page.getByRole('navigation').getByRole('link', { name: 'E2E Tutorial' });
    await expect(navLink).toBeVisible();
    await navLink.click();
    await expect(page).toHaveURL(/.*e2e-tutorial/);
    await expect(page.getByRole('heading', { name: /Controlling a nested multi-service stack/i })).toBeVisible();
  });
});
