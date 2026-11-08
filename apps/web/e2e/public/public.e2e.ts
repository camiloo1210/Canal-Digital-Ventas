import { expect, test } from '@playwright/test';
import { withSpanishLocale } from '@/e2e/support/locale';

test.beforeEach(async ({ context, baseURL }): Promise<void> => {
  await withSpanishLocale(context, baseURL ?? 'http://localhost:3100');
});

test('home lists the store directory', async ({ page }): Promise<void> => {
  const response = await page.goto('/');
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('anonymous user is redirected from /dashboard to /login', async ({ page }): Promise<void> => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('anonymous user is redirected from /purchases to /login keeping redirectTo', async ({
  page,
}): Promise<void> => {
  await page.goto('/purchases');
  await expect(page).toHaveURL(/\/login.*purchases/);
});

// The proxy redirects anonymous requests for unknown top-level paths to /login, so the 404 is requested
// under a public prefix (/login/...). /store/<unknown slug> answers 404 with an empty body (see report).
test('unknown route renders the localized not-found page', async ({ page }): Promise<void> => {
  await page.goto('/login/ruta-inexistente-e2e');
  await expect(
    page.getByRole('heading', { level: 1, name: 'No encontramos esta página' }),
  ).toBeVisible();
  await expect(page.getByText('Error 404 · Página no encontrada')).toBeVisible();
});
