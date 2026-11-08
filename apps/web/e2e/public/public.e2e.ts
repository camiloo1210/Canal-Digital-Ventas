import { expect, test } from '@playwright/test';
import { withSpanishLocale } from '@/e2e/support/locale';

test.beforeEach(async ({ context, baseURL }): Promise<void> => {
  await withSpanishLocale(context, baseURL ?? 'http://localhost:3100');
});

const LOGIN_HEADING = 'Inicia sesión en tu cuenta';

// The store directory is not public: an anonymous visitor is sent to the login (the directory itself
// is covered with a signed-in buyer in buyer/purchase.e2e.ts).
test('anonymous user visiting the home page is redirected to /login', async ({
  page,
}): Promise<void> => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login\?redirectTo=%2F$/);
  await expect(page.getByRole('heading', { level: 1, name: LOGIN_HEADING })).toBeVisible();
});

test('anonymous user is redirected from /dashboard to /login', async ({ page }): Promise<void> => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { level: 1, name: LOGIN_HEADING })).toBeVisible();
});

test('anonymous user is redirected from /purchases to /login keeping redirectTo', async ({
  page,
}): Promise<void> => {
  await page.goto('/purchases');
  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fpurchases/);
  await expect(page.getByRole('heading', { level: 1, name: LOGIN_HEADING })).toBeVisible();
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
