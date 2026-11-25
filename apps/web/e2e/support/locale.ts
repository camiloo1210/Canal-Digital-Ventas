import type { BrowserContext } from '@playwright/test';

export async function withSpanishLocale(context: BrowserContext, baseURL: string): Promise<void> {
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'es', url: baseURL }]);
}
