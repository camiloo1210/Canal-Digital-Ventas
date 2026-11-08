import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from '@/e2e/support/navigation';
import { BUYER_STATE } from '@/e2e/support/paths';
import { actors, catalog, readRunId } from '@/e2e/support/test-data';

const runId = readRunId();
const slug = actors(runId).seller.storeSlug;
const data = catalog(runId);

test.use({ storageState: BUYER_STATE });
test.describe.configure({ mode: 'serial', timeout: 90_000 });

async function openProduct(page: Page): Promise<void> {
  await gotoHydrated(page, `/store/${slug}`);
  await page.getByPlaceholder('Buscar productos...').fill(data.productName);
  // The search updates the URL after a debounce; clicking earlier is overridden by that navigation.
  await expect(page).toHaveURL(/[?&]q=/);
  await page.getByRole('link', { name: data.productName }).first().click();
  await expect(page).toHaveURL(/\/products\//, { timeout: 30_000 });
}

test('empty cart cannot be checked out', async ({ page }): Promise<void> => {
  await gotoHydrated(page, `/store/${slug}/checkout`);
  await expect(page.getByText('0 artículos')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar Pedido' })).toBeDisabled();
});

test('buyer finds the product from the store page', async ({ page }): Promise<void> => {
  await openProduct(page);
  await expect(page.getByRole('heading', { name: data.productName })).toBeVisible();
  await expect(page.getByText(/12[.,]50/).first()).toBeVisible();
});

test('quantity is capped at the available stock', async ({ page }): Promise<void> => {
  await openProduct(page);
  await page.getByRole('button', { name: 'Añadir al Carrito' }).click();
  await page.getByRole('button', { name: 'Abrir carrito' }).click();
  const increase = page.getByRole('button', { name: `Aumentar cantidad de ${data.productName}` });
  for (let i = 1; i < data.stock; i += 1) await increase.click();
  await expect(increase).toBeDisabled();
  // The quantity <span> sits between the decrease and increase buttons.
  await expect(increase.locator('xpath=preceding-sibling::span[1]')).toHaveText(String(data.stock));
});

test('buyer adds to cart and completes checkout', async ({ page }): Promise<void> => {
  await openProduct(page);
  await page.getByRole('button', { name: 'Añadir al Carrito' }).click();
  await gotoHydrated(page, `/store/${slug}/checkout`);
  await page.getByRole('textbox', { name: /Nombre completo/ }).fill('Comprador Prueba');
  await page.getByRole('textbox', { name: /Correo electrónico/ }).fill(actors(runId).buyer.email);
  await page.getByRole('textbox', { name: /Teléfono/ }).fill('0991234567');
  await page.getByRole('textbox', { name: /Documento de identidad/ }).fill('1311111111');
  await page.getByRole('textbox', { name: /Calle y número/ }).fill('Av. 24 de Mayo 123');
  await page.getByRole('textbox', { name: /Ciudad/ }).fill('Manta');
  await page.getByRole('textbox', { name: /Estado \/ Provincia/ }).fill('Manabí');
  await page.getByRole('textbox', { name: /Código postal/ }).fill('130802');
  await page.getByRole('textbox', { name: /País/ }).fill('Ecuador');
  await page.getByRole('button', { name: 'Confirmar Pedido' }).click();
  await expect(page.getByText('¡Pedido Confirmado!')).toBeVisible({ timeout: 30_000 });
});

test('order appears in /purchases', async ({ page }): Promise<void> => {
  await gotoHydrated(page, '/purchases');
  await expect(page.getByText(data.productName).first()).toBeVisible();
});
