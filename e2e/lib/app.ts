import { expect, type Page } from '@playwright/test';

/** Open the Expo web app, sign in as the demo user and open Discover. */
export async function openDiscover(page: Page) {
  // Log failed requests to help diagnose login issues
  page.on('requestfailed', req => {
    console.error(`[Request failed] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`[Browser console error] ${msg.text()}`);
    }
  });
  
  await page.goto('/');
  const inputs = page.locator('input');
  await expect(inputs.first().or(page.getByText('Discover').last())).toBeVisible({ timeout: 60_000 });
  if ((await inputs.count()) >= 2) {
    await inputs.nth(0).fill('wanderer');
    await inputs.nth(1).fill('wanderer');
    await page.getByText('Sign in').last().click();
  }
  await page.getByText('Discover').last().click();
  await expect(page.getByText('Atlantis Boardwalk').first()).toBeVisible({ timeout: 30_000 });
}

/** Leave and re-open Discover, which refetches /api/discover. */
export async function refetchDiscover(page: Page) {
  await page.getByText('Trips').last().click();
  await page.getByText('Discover').last().click();
}

/** The Temperature tile on the Atlantis card shows `${n}°`. */
export async function expectTemperature(page: Page, n: number) {
  await expect(page.getByText(`${n}°`, { exact: true })).toBeVisible({ timeout: 20_000 });
}

/** Re-open Discover until `assertion` passes (the first refetch can race a just-made change). */
async function untilAfterRefetch(page: Page, assertion: () => Promise<void>) {
  await expect(async () => {
    await refetchDiscover(page);
    await assertion();
  }).toPass({ timeout: 45_000 });
}

/** Re-open Discover until the tile shows n. */
export async function expectTemperatureAfterRefetch(page: Page, n: number) {
  await untilAfterRefetch(page, () => expect(page.getByText(`${n}°`, { exact: true })).toBeVisible({ timeout: 5_000 }));
}

/** Value text under the Temperature label on the Atlantis card. */
export function temperatureTile(page: Page) {
  return page.getByText('Temperature', { exact: true }).locator('xpath=following-sibling::*[1]');
}

/** Re-open Discover until the tile shows a temperature that is none of `excluded` (e.g. live weather). */
export async function expectTemperatureOtherThanAfterRefetch(page: Page, excluded: number[]) {
  const otherTemperature = new RegExp(`^(?!(${excluded.join('|')})°$)-?\\d+(\\.\\d+)?°$`);
  await untilAfterRefetch(page, () => expect(temperatureTile(page)).toHaveText(otherTemperature, { timeout: 5_000 }));
}
