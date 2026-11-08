import { expect, test } from '@playwright/test';
import { BUYER_STATE, SELLER_STATE } from '@/e2e/support/paths';
import { catalog, readRunId } from '@/e2e/support/test-data';
import { gotoHydrated } from '@/e2e/support/navigation';
import { withSpanishLocale } from '@/e2e/support/locale';

const data = catalog(readRunId());

test.use({ storageState: SELLER_STATE });
test.describe.configure({ mode: 'serial', timeout: 90_000 });

test('seller creates a category', async ({ page }): Promise<void> => {
  await gotoHydrated(page, '/dashboard/catalog/categories/new');
  await page.getByLabel('Nombre de Categoría').fill(data.categoryName);
  await page.getByRole('button', { name: 'Crear Categoría' }).click();
  await gotoHydrated(page, '/dashboard/catalog/categories');
  await expect(page.getByText(data.categoryName).first()).toBeVisible({ timeout: 30_000 });
});

test('seller creates an active product in that category', async ({ page }): Promise<void> => {
  await gotoHydrated(page, '/dashboard/catalog/products/new');
  await page.getByRole('textbox', { name: 'Nombre del Producto' }).fill(data.productName);
  await page.getByRole('textbox', { name: 'SKU' }).fill(data.sku);
  await page.getByRole('combobox', { name: 'Categoría' }).click();
  await page.getByRole('option', { name: data.categoryName }).click();
  await page.getByRole('textbox', { name: 'Precio de venta (USD)' }).fill(data.priceText);
  await page.getByRole('textbox', { name: 'Costo (USD)' }).fill('8.00');
  await page.getByRole('textbox', { name: 'Existencias' }).fill(String(data.stock));
  await page.getByRole('button', { name: 'Crear producto' }).click();
  await gotoHydrated(page, '/dashboard/catalog/products');
  await expect(page.getByText(data.productName).first()).toBeVisible({ timeout: 30_000 });
});

test('product form keeps typed values when the server rejects it', async ({
  page,
}): Promise<void> => {
  await gotoHydrated(page, '/dashboard/catalog/products/new');
  await page.getByRole('textbox', { name: 'Nombre del Producto' }).fill('Producto invalido E2E');
  await page.getByRole('textbox', { name: 'SKU' }).fill('E2E-INVALID');
  await page.getByRole('textbox', { name: 'Precio de venta (USD)' }).fill('abc');
  await page.getByRole('textbox', { name: 'Costo (USD)' }).fill('8.00');
  await page.getByRole('textbox', { name: 'Existencias' }).fill('1');
  await page.getByRole('button', { name: 'Crear producto' }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre del Producto' })).toHaveValue(
    'Producto invalido E2E',
  );
  await expect(page.getByRole('textbox', { name: 'SKU' })).toHaveValue('E2E-INVALID');
});

test('buyer cannot open the seller dashboard', async ({ browser, baseURL }): Promise<void> => {
  const context = await browser.newContext({ storageState: BUYER_STATE });
  await withSpanishLocale(context, baseURL ?? 'http://localhost:3100');
  const page = await context.newPage();
  try {
    await gotoHydrated(page, '/dashboard/catalog/products');
    await expect(page).not.toHaveURL(/\/dashboard\/catalog/);
    await expect(page.getByText(data.productName)).toHaveCount(0);
  } finally {
    await context.close();
  }
});
