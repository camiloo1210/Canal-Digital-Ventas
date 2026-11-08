import type { Page } from '@playwright/test';

/** In dev mode the first visit compiles the route; typing before hydration finishes gets wiped. */
export async function gotoHydrated(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
}
