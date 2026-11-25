import { expect, test, type Page } from '@playwright/test';
import { BUYER_STATE, SELLER_STATE } from '@/e2e/support/paths';
import { gotoHydrated } from '@/e2e/support/navigation';
import { catalog, readRunId } from '@/e2e/support/test-data';

// This suite uses the order created by the preceding lifecycle project. The guide is entered
// manually; FedEx is only exercised when an explicitly provisioned sandbox is enabled.

const fedexEnabled = process.env.E2E_FEDEX_SANDBOX === '1';
const guide = fedexEnabled ? (process.env.E2E_FEDEX_TRACKING_NUMBER ?? '') : 'E2E-MANUAL-GUIDE';
const expectedEvent = process.env.E2E_FEDEX_EXPECTED_EVENT ?? '';
test.describe.configure({ mode: 'serial', timeout: 120_000 });

async function sellerOrder(page: Page): Promise<void> {
  await gotoHydrated(page, '/dashboard/orders');
  await page
    .getByRole('row', { name: /Comprador Prueba/ })
    .getByRole('link')
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function buyerDetail(page: Page): Promise<void> {
  await gotoHydrated(page, '/purchases');
  const card = page
    .locator('[data-slot=card]')
    .filter({ hasText: catalog(readRunId()).productName })
    .first();
  await card.getByRole('link', { name: /ver detalle/i }).click();
  await expect(page).toHaveURL(/\/purchases\/[0-9a-f-]+/i);
}

test.describe('seller records shipment', (): void => {
  test.use({ storageState: SELLER_STATE });
  test('records the guide without claiming live tracking', async ({ page }): Promise<void> => {
    expect(guide).not.toBe('');
    await sellerOrder(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/no activa rastreo en tiempo real/i)).toBeVisible();
    await dialog
      .getByLabel('Transportadora')
      .fill(fedexEnabled ? 'FedEx' : 'Transportadora de prueba');
    await dialog.getByLabel('Número de guía').fill(guide);
    await dialog.getByRole('button', { name: 'Guardar envío' }).click();
    await expect(dialog.getByText(guide, { exact: true })).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('buyer sees private shipment detail', (): void => {
  test.use({ storageState: BUYER_STATE });
  test('sees the recorded guide and its manual origin', async ({ page }): Promise<void> => {
    await buyerDetail(page);
    await expect(page.getByText(guide, { exact: true })).toBeVisible();
    await expect(page.getByText(/registrad[oa] por la tienda/i)).toBeVisible();
  });
});

test.describe('FedEx sandbox', (): void => {
  test.skip(
    !fedexEnabled,
    'Requires an explicitly configured FedEx sandbox, isolated database and worker.',
  );
  test('seller enables tracking for the saved guide', async ({ browser }): Promise<void> => {
    const context = await browser.newContext({ storageState: SELLER_STATE });
    try {
      const page = await context.newPage();
      await sellerOrder(page);
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Activar FedEx de prueba' }).click();
      await expect(dialog.getByRole('button', { name: 'Desactivar seguimiento' })).toBeVisible({
        timeout: 30_000,
      });
    } finally {
      await context.close();
    }
  });
  test('buyer sees an actual sandbox event alongside the commercial order status', async ({
    browser,
  }): Promise<void> => {
    expect(
      expectedEvent,
      'Set E2E_FEDEX_EXPECTED_EVENT to a documented event supported by the test guide',
    ).not.toBe('');
    const context = await browser.newContext({ storageState: BUYER_STATE });
    try {
      const page = await context.newPage();
      await buyerDetail(page);
      const path = new URL(page.url()).pathname;
      await expect(async (): Promise<void> => {
        await gotoHydrated(page, path);
        const timeline = page.getByRole('region', { name: 'Seguimiento del env�o' });
        await expect(timeline.getByText(expectedEvent, { exact: true }).first()).toBeVisible({
          timeout: 3_000,
        });
      }).toPass({ timeout: 90_000 });
      const timeline = page.getByRole('region', { name: 'Seguimiento del env�o' });
      await expect(timeline.getByText(/datos de prueba proporcionados por fedex/i)).toBeVisible();
      await expect(timeline.getByText(/�ltima consulta/i)).toBeVisible();
      await expect(page.getByText('La tienda marcó este pedido como entregado.')).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
