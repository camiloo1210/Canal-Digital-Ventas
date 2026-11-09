import { expect, test } from '@playwright/test';
import { BUYER_STATE, SELLER_STATE } from '@/e2e/support/paths';
import { catalog, readRunId } from '@/e2e/support/test-data';
import { gotoHydrated, openUntilVisible } from '@/e2e/support/navigation';

const data = catalog(readRunId());

test.use({ storageState: SELLER_STATE });
test.describe.configure({ mode: 'serial', timeout: 90_000 });

test('seller creates a category', async ({ page }): Promise<void> => {
  await gotoHydrated(page, '/dashboard/catalog/categories/new');
  await page.getByLabel('Nombre de Categoría').fill(data.categoryName);
  await page.getByRole('button', { name: 'Crear Categoría' }).click();
  await page.waitForLoadState('networkidle');
  await openUntilVisible(
    page,
    '/dashboard/catalog/categories',
    page.getByText(data.categoryName).first(),
  );
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
  await page.waitForLoadState('networkidle');
  await openUntilVisible(
    page,
    '/dashboard/catalog/products',
    page.getByText(data.productName).first(),
  );
});

test('product form shows the server error and keeps typed values', async ({
  page,
}): Promise<void> => {
  const name = page.getByRole('textbox', { name: 'Nombre del Producto' });
  const sku = page.getByRole('textbox', { name: 'SKU' });
  const price = page.getByRole('textbox', { name: 'Precio de venta (USD)' });
  await gotoHydrated(page, '/dashboard/catalog/products/new');
  await name.fill('Producto invalido E2E');
  await sku.fill('E2E-INVALID');
  // A valid category isolates the rejection to the price, the only invalid field.
  await page.getByRole('combobox', { name: 'Categoría' }).click();
  await page.getByRole('option', { name: data.categoryName }).click();
  await price.fill('abc');
  await page.getByRole('textbox', { name: 'Costo (USD)' }).fill('8.00');
  await page.getByRole('textbox', { name: 'Existencias' }).fill('1');
  await page.getByRole('button', { name: 'Crear producto' }).click();
  await expect(page.getByText('Usa un importe válido con hasta 2 decimales').first()).toBeVisible();
  await expect(price).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Selecciona una categoría.')).toHaveCount(0);
  await expect(name).toHaveValue('Producto invalido E2E');
  await expect(sku).toHaveValue('E2E-INVALID');
});

test.describe('buyer session', (): void => {
  test.use({ storageState: BUYER_STATE });

  // A user with no store is sent to onboarding instead of the seller dashboard.
  test('buyer cannot open the seller dashboard', async ({ page }): Promise<void> => {
    await gotoHydrated(page, '/dashboard/catalog/products');
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(
      page.getByRole('heading', { name: 'Termine de configurar su tienda' }),
    ).toBeVisible();
    await expect(page.getByText(data.productName)).toHaveCount(0);
  });
});
