import { test, expect } from '@playwright/test';

test.describe('Introduction Page', () => {
  test('should display main content in the new section order', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /Record real APIs.*Replay them anywhere/i })
    ).toBeVisible();
    await expect(
      page.getByText(/Record real traffic from fetch, axios and React Native/i)
    ).toBeVisible();

    // Problems — four cards (merged with use cases)
    const problems = page.getByTestId('problems-section');
    await expect(problems.getByRole('heading', { name: /Problems Mockifyer solves/i })).toBeVisible();
    await expect(problems.getByText(/API isn't ready yet/i)).toBeVisible();
    await expect(problems.getByText(/Hard-to-reproduce states/i)).toBeVisible();
    await expect(problems.getByText(/Deterministic offline E2E/i)).toBeVisible();
    await expect(problems.getByText(/React Native & Expo/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Use Cases/i })).toHaveCount(0);

    // How it works + setup tabs
    const how = page.getByTestId('how-it-works-section');
    await expect(how.getByRole('heading', { name: /How it works/i })).toBeVisible();
    await expect(how.getByRole('heading', { name: '1. Initialize' })).toBeVisible();
    await expect(how.getByRole('heading', { name: '2. Activate mocks' })).toBeVisible();
    await expect(how.getByRole('heading', { name: '3. Replay in tests' })).toBeVisible();
    await expect(page.locator('#setup')).toBeVisible();
    await expect(page.locator('#date-freezing')).toHaveCount(0);
    await expect(page.getByTestId('setup-tab-node')).toBeVisible();
    await expect(page.getByTestId('setup-tab-rn')).toBeVisible();
    await page.getByTestId('setup-tab-rn').click();
    await expect(page.getByText(/setupMockifyerForReactNative/i)).toBeVisible();

    // Hero no longer has feature pills
    await expect(page.getByText(/^Record & replay$/)).toHaveCount(0);
  });

  test('section order: See it → Atlas → comparison → free tool → CTA', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const see = page.getByTestId('see-it-in-action');
    const atlas = page.locator('#atlas-showcase');
    const comparison = page.getByTestId('comparison-section');
    const teaser = page.getByTestId('start-page-mock-generator');
    const cta = page.getByTestId('get-started-cta');

    await expect(atlas).toBeVisible();
    await expect(teaser).toBeVisible({ timeout: 15_000 });

    const boxes = await Promise.all([
      see.boundingBox(),
      atlas.boundingBox(),
      comparison.boundingBox(),
      teaser.boundingBox(),
      cta.boundingBox(),
    ]);
    for (const box of boxes) expect(box).toBeTruthy();
    expect(boxes[0]!.y).toBeLessThan(boxes[1]!.y);
    expect(boxes[1]!.y).toBeLessThan(boxes[2]!.y);
    expect(boxes[2]!.y).toBeLessThan(boxes[3]!.y);
    expect(boxes[3]!.y).toBeLessThan(boxes[4]!.y);
  });

  test('should display Atlas showcase', async ({ page }) => {
    await page.goto('/');

    const section = page.locator('#atlas-showcase');
    await expect(section).toBeVisible();
    await expect(page.getByRole('heading', { name: /See what Mockifyer sees/i })).toBeVisible();
    await expect(
      section.getByText(/Generated automatically from 1205 requests in our Playwright E2E suite/i)
    ).toBeVisible();
    await expect(section.getByRole('img', { name: /WanderWeird Atlas/i })).toBeVisible();
    await expect(section.getByText(/Run your Playwright tests with Mockifyer/i)).toBeVisible();
    await expect(section.getByText(/Atlas artifact \(CI\)/i)).toBeVisible();

    const openLink = section.getByRole('link', { name: /Open full Atlas/i });
    await expect(openLink).toBeVisible();
    await expect(openLink).toHaveAttribute('href', '/atlas/wanderweird/');

    const howTo = section.getByRole('link', { name: /How to automate this/i });
    await expect(howTo).toBeVisible();
    await expect(howTo).toHaveAttribute('href', '/guides/atlas-from-playwright');
  });

  test('should display showcase videos', async ({ page }) => {
    await page.goto('/');

    const mainVideo = page.locator('video[autoplay]').first();
    await expect(mainVideo).toBeVisible();

    const hoverVideos = page.locator('video[poster]');
    expect(await hoverVideos.count()).toBeGreaterThanOrEqual(2);
  });

  test('should have working links to other pages', async ({ page }) => {
    await page.goto('/');

    const tutorialLink = page.getByRole('link', { name: /E2E Tutorial/i }).first();
    await expect(tutorialLink).toBeVisible();

    const getStartedLink = page.getByRole('link', { name: 'Get Started' }).first();
    await expect(getStartedLink).toBeVisible();
  });

  test('should have Open in StackBlitz near the try command', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/Get started in 2 minutes/i)).toBeVisible();
    const stackblitz = page.getByRole('link', { name: /Open in StackBlitz/i }).first();
    await expect(stackblitz).toBeVisible();
    await expect(stackblitz).toHaveAttribute(
      'href',
      'https://stackblitz.com/github/sgedda/mockifyer/tree/main/examples/stackblitz-quickstart'
    );
  });

  test('should switch gallery media when clicking thumbnails', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const mainPlayer = page.locator('video').first();
    const initialSrc = await mainPlayer.getAttribute('src');
    expect(initialSrc).toContain('delay-and-status-override');

    const thumbnails = page.locator('button[aria-pressed]');
    await expect(thumbnails).toHaveCount(3);
    await expect(thumbnails.nth(0)).toHaveAttribute('aria-pressed', 'true');

    await thumbnails.nth(1).click();
    await page.waitForTimeout(100);

    const newSrc = await mainPlayer.getAttribute('src');
    expect(newSrc).toContain('mock-editor-body-edit');
    await expect(thumbnails.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(thumbnails.nth(0)).toHaveAttribute('aria-pressed', 'false');

    await thumbnails.nth(2).click();
    await page.waitForTimeout(100);

    const thirdSrc = await mainPlayer.getAttribute('src');
    expect(thirdSrc).toContain('header-scenario-picker');
    await expect(thumbnails.nth(2)).toHaveAttribute('aria-pressed', 'true');
    await expect(thumbnails.nth(1)).toHaveAttribute('aria-pressed', 'false');
  });

  test('should load all thumbnail posters in gallery', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const thumbnailButtons = page.locator('button[aria-pressed]');
    await expect(thumbnailButtons).toHaveCount(3);

    for (let i = 0; i < 3; i++) {
      const thumbnailVideo = thumbnailButtons.nth(i).locator('video');
      await expect(thumbnailVideo).toBeVisible();
      const poster = await thumbnailVideo.getAttribute('poster');
      expect(poster).toBeTruthy();
      expect(poster).toContain('.jpg');
      const response = await page.request.get(poster!);
      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);
    }
  });
});
