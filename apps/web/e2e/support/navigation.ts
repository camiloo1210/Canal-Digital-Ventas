import { expect, type Locator, type Page } from '@playwright/test';

/** In dev mode the first visit compiles the route; typing before hydration finishes gets wiped. */
export async function gotoHydrated(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
}

/**
 * Server Actions finish after the click returns. Reload the page until the saved record shows up
 * instead of reading one stale render (slower runs, such as the UI mode with video/trace, lose that race).
 */
export async function openUntilVisible(
  page: Page,
  url: string,
  target: Locator,
  timeoutMs: number = 45_000,
): Promise<void> {
  await expect(async (): Promise<void> => {
    await gotoHydrated(page, url);
    await expect(target).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: timeoutMs });
}
