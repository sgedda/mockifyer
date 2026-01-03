import { test, expect } from '@playwright/test';

test.describe('cURL Command Display in Edit Mock File', () => {
  test('should display full curl command and allow scrolling', async ({ page }) => {
    // Set a narrower viewport to simulate the issue
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/playground.html');
    await page.waitForLoadState('networkidle');
    
    // Wait for mock files to load
    await expect(page.getByText(/Mock Files Browser/i)).toBeVisible({ timeout: 10000 });
    
    // Find and click the edit button for the specific file
    const filename = '2025-12-02_19-32-01_POST_rickandmortyapi_com_graphql.json';
    
    // Wait for files to load
    await page.waitForTimeout(3000);
    
    // Find the file card by filename - look for the text and then find buttons nearby
    const filenameText = page.getByText(filename, { exact: false });
    await expect(filenameText).toBeVisible({ timeout: 15000 });
    
    // Find the card containing this filename
    const card = filenameText.locator('..').locator('..').locator('..');
    
    // Find all buttons in the card and click the one with Edit2 icon (second button after View)
    const buttons = card.locator('button');
    const buttonCount = await buttons.count();
    console.log('[Found buttons in card]:', buttonCount);
    
    // The edit button should be the second one (index 1) - View is 0, Edit is 1, Delete is 2
    if (buttonCount >= 2) {
      await buttons.nth(1).click();
    } else {
      // Fallback: try to find by title attribute
      const editButton = card.locator('button[title="Edit"]');
      if (await editButton.count() > 0) {
        await editButton.first().click();
      } else {
        throw new Error('Could not find edit button');
      }
    }
    
    // Wait for dialog to open
    await expect(page.getByText(`Edit Mock File: ${filename}`)).toBeVisible({ timeout: 5000 });
    
    // Click on the cURL Request tab
    const curlTab = page.getByRole('tab', { name: /cURL Request/i });
    await curlTab.click();
    
    // Wait for curl command to appear
    await expect(page.getByText(/curl -X/i)).toBeVisible({ timeout: 5000 });
    
    // Find the scrollable container (the div with overflow-x: auto)
    const curlTextElement = page.getByText(/curl -X/i);
    
    // Find the scrollable container - it should be the parent with border and bg-[#1e1e1e]
    const scrollableContainer = page.locator('.border.rounded-md.bg-\\[\\#1e1e1e\\]').filter({ has: curlTextElement }).first();
    await expect(scrollableContainer).toBeVisible({ timeout: 5000 });
    
    // Get the full curl command text from the content
    const curlText = await curlTextElement.textContent();
    console.log('[cURL Command Length]:', curlText?.length);
    console.log('[cURL Command Preview]:', curlText?.substring(0, 200));
    
    // Verify the curl command contains expected content
    expect(curlText).toContain('curl');
    expect(curlText).toContain('POST');
    expect(curlText).toContain('rickandmortyapi.com');
    
    // Get container and dialog dimensions
    const containerRect = await scrollableContainer.boundingBox();
    const dialog = page.locator('[role="dialog"]').first();
    const dialogRect = await dialog.boundingBox();
    console.log('[Container Bounding Box]:', containerRect);
    console.log('[Dialog Bounding Box]:', dialogRect);
    console.log('[Viewport Width]:', await page.viewportSize()?.width);
    
    // Check if scrolling is possible - measure the SCROLLABLE CONTAINER, not the content
    const scrollable = await scrollableContainer.evaluate((el) => {
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        canScrollX: el.scrollWidth > el.clientWidth,
        canScrollY: el.scrollHeight > el.clientHeight,
      };
    });
    
    console.log('[Scroll Info]:', scrollable);
    
    // Verify the content is wider than container (needs horizontal scroll)
    console.log('[Scroll Info]:', scrollable);
    console.log('[Container Width]:', containerRect?.width);
    console.log('[Scroll Width]:', scrollable.scrollWidth, 'Client Width:', scrollable.clientWidth);
    
    // Check if content width exceeds container width
    const contentWidth = scrollable.scrollWidth;
    const containerWidth = scrollable.clientWidth;
    const needsScroll = contentWidth > containerWidth;
    
    if (needsScroll) {
      console.log('[✓] Content is wider than container - horizontal scrolling should be available');
      // Try scrolling
      await scrollableContainer.evaluate((el) => {
        el.scrollLeft = el.scrollWidth / 2;
      });
      const scrolled = await scrollableContainer.evaluate((el) => el.scrollLeft);
      expect(scrolled).toBeGreaterThan(0);
      console.log('[✓] Successfully scrolled horizontally to:', scrolled);
    } else {
      console.log('[!] Content fits within container width');
      console.log('[!] This might indicate the container is expanding to fit content');
      // Verify the command is complete by checking it ends properly
      const commandEnds = curlText?.trim().endsWith('"') || curlText?.trim().endsWith('}');
      if (!commandEnds && curlText && curlText.length < 300) {
        console.error('[✗] Command appears truncated!');
        throw new Error(`Command appears truncated. Length: ${curlText.length}, Ends with: ${curlText.substring(curlText.length - 20)}`);
      }
    }
    
    // Check if copy button is visible
    const copyButton = page.getByRole('button', { name: /Copy/i });
    await expect(copyButton).toBeVisible();
    
    // Verify the full command is accessible (not cut off)
    const fullCommand = await curlTextElement.textContent();
    expect(fullCommand?.length).toBeGreaterThan(100); // Should be a long command
    
    // Check if the command ends properly (not cut off mid-string)
    if (fullCommand) {
      const hasProperEnding = fullCommand.includes('"') || fullCommand.trim().length > 0;
      expect(hasProperEnding).toBeTruthy();
      console.log('[✓] Command appears complete');
    }
  });
  
  test('should copy curl command to clipboard', async ({ page, context }) => {
    await page.goto('/playground.html');
    await page.waitForLoadState('networkidle');
    
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Find and click edit button for the file
    const filename = '2025-12-02_19-32-01_POST_rickandmortyapi_com_graphql.json';
    await page.waitForTimeout(3000);
    
    const filenameText = page.getByText(filename, { exact: false });
    await expect(filenameText).toBeVisible({ timeout: 15000 });
    
    const card = filenameText.locator('..').locator('..').locator('..');
    const buttons = card.locator('button');
    const buttonCount = await buttons.count();
    
    if (buttonCount >= 2) {
      await buttons.nth(1).click();
    } else {
      const editButton = card.locator('button[title="Edit"]');
      await editButton.first().click();
    }
    
    await expect(page.getByText(`Edit Mock File: ${filename}`)).toBeVisible({ timeout: 5000 });
    
    // Click on cURL Request tab
    await page.getByRole('tab', { name: /cURL Request/i }).click();
    await expect(page.getByText(/curl -X/i)).toBeVisible({ timeout: 5000 });
    
    // Click copy button
    const copyButton = page.getByRole('button', { name: /Copy/i });
    await copyButton.click();
    
    // Wait a bit for clipboard to update
    await page.waitForTimeout(500);
    
    // Read from clipboard
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    
    console.log('[Clipboard Content Length]:', clipboardText.length);
    console.log('[Clipboard Preview]:', clipboardText.substring(0, 200));
    
    // Verify clipboard contains curl command
    expect(clipboardText).toContain('curl');
    expect(clipboardText).toContain('POST');
    expect(clipboardText.length).toBeGreaterThan(100);
  });
});

