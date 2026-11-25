import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test as setup } from '@playwright/test';
import { absolutePath, BUYER_STATE, RUN_FILE, SELLER_STATE } from '@/e2e/support/paths';
import { actors, runId } from '@/e2e/support/test-data';
import { withSpanishLocale } from '@/e2e/support/locale';
import { gotoHydrated } from '@/e2e/support/navigation';

const FALLBACK_BASE_URL = 'http://localhost:3100';

setup.describe.configure({ mode: 'serial', timeout: 240_000 });

setup.beforeAll((): void => {
  const runFile = absolutePath(RUN_FILE);
  mkdirSync(path.dirname(runFile), { recursive: true });
  writeFileSync(runFile, JSON.stringify({ runId }), 'utf8');
});

setup(
  'seller signs up a business and lands on /dashboard',
  async ({ browser, baseURL }): Promise<void> => {
    const { seller } = actors(runId);
    const context = await browser.newContext();
    await withSpanishLocale(context, baseURL ?? FALLBACK_BASE_URL);
    const page = await context.newPage();
    try {
      await gotoHydrated(page, '/signup/business');
      await page.getByLabel('First Name', { exact: true }).fill(seller.firstName);
      await page.getByLabel('Last Name', { exact: true }).fill(seller.lastName);
      await page.getByLabel('Email', { exact: true }).fill(seller.email);
      await page.getByLabel('Password', { exact: true }).fill(seller.password);
      await page.getByLabel('Store Name', { exact: true }).fill(seller.storeName);
      await page.getByLabel('Store URL (Slug)', { exact: true }).fill(seller.storeSlug);
      await page.getByRole('button', { name: 'Create Account & Store' }).click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 90_000 });
      await context.storageState({ path: absolutePath(SELLER_STATE) });
    } finally {
      await context.close();
    }
  },
);

setup('buyer signs up as client', async ({ browser, baseURL }): Promise<void> => {
  const { buyer } = actors(runId);
  const context = await browser.newContext();
  await withSpanishLocale(context, baseURL ?? FALLBACK_BASE_URL);
  const page = await context.newPage();
  try {
    // Public buyer signup. /client/signup is a legacy page that redirects to a missing /buyer-dashboard.
    await gotoHydrated(page, '/signup?redirectTo=%2Fpurchases');
    await page.getByLabel('Correo electrónico', { exact: true }).fill(buyer.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(buyer.password);
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    await expect(page).toHaveURL(/\/purchases/, { timeout: 45_000 });
    await context.storageState({ path: absolutePath(BUYER_STATE) });
  } finally {
    await context.close();
  }
});
