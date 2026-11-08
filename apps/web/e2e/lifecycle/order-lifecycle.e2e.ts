import { expect, test } from '@playwright/test';
import { BUYER_STATE, SELLER_STATE } from '@/e2e/support/paths';
import { gotoHydrated } from '@/e2e/support/navigation';
import { withSpanishLocale } from '@/e2e/support/locale';
import { markConfirmedOrdersPaidWithoutPayment } from '@/e2e/support/simulated-payment';
import { actors, catalog, readRunId } from '@/e2e/support/test-data';

const runId = readRunId();
const data = catalog(runId);
const slug = actors(runId).seller.storeSlug;
const FALLBACK_BASE_URL = 'http://localhost:3100';

test.describe.configure({ mode: 'serial', timeout: 180_000 });

/**
 * Sellers can only advance PAID orders with a settled payment (nextLogisticsStatus and
 * ChangeOrderStatusUseCase in packages/core). With the payment UI off, a checkout leaves the order
 * CONFIRMED. This test covers that state: both roles see the same order and no logistics step.
 */
test('seller and buyer both see the confirmed order awaiting payment', async ({
  browser,
  baseURL,
}): Promise<void> => {
  const url = baseURL ?? FALLBACK_BASE_URL;
  const sellerContext = await browser.newContext({ storageState: SELLER_STATE });
  const buyerContext = await browser.newContext({ storageState: BUYER_STATE });
  await withSpanishLocale(sellerContext, url);
  await withSpanishLocale(buyerContext, url);
  const seller = await sellerContext.newPage();
  const buyer = await buyerContext.newPage();
  try {
    await gotoHydrated(seller, '/dashboard/orders');
    const row = seller.getByRole('row', { name: /Comprador Prueba/ });
    await expect(row).toContainText('Confirmado');
    await row.getByRole('link').first().click();
    await expect(seller.getByText(data.productName).first()).toBeVisible();
    await expect(
      seller.getByText('Este pedido no tiene un avance logístico disponible.'),
    ).toBeVisible();

    await gotoHydrated(buyer, '/purchases');
    await expect(buyer.getByText(data.productName).first()).toBeVisible();
    await expect(buyer.getByText('Confirmado').first()).toBeVisible();
  } finally {
    await sellerContext.close();
    await buyerContext.close();
  }
});

/**
 * PAYMENT SIMULATED, NOT TESTED: the order is marked paid directly in the local database
 * (see support/simulated-payment.ts). Lemon Squeezy itself is NOT covered by this test.
 */
test('with the payment simulated, seller advances the order and buyer sees each status', async ({
  browser,
  baseURL,
}): Promise<void> => {
  expect(await markConfirmedOrdersPaidWithoutPayment(slug)).toBe(1);
  const url = baseURL ?? FALLBACK_BASE_URL;
  const sellerContext = await browser.newContext({ storageState: SELLER_STATE });
  const buyerContext = await browser.newContext({ storageState: BUYER_STATE });
  await withSpanishLocale(sellerContext, url);
  await withSpanishLocale(buyerContext, url);
  const seller = await sellerContext.newPage();
  const buyer = await buyerContext.newPage();
  const steps = [
    { action: 'Comenzar preparación', status: 'En Proceso' },
    { action: 'Marcar como enviado', status: 'Enviado' },
    { action: 'Marcar como entregado', status: 'Entregado' },
  ] as const;
  try {
    await gotoHydrated(buyer, '/purchases');
    await expect(buyer.getByText('Pagado').first()).toBeVisible();
    for (const step of steps) {
      await gotoHydrated(seller, '/dashboard/orders');
      await seller
        .getByRole('row', { name: /Comprador Prueba/ })
        .getByRole('link')
        .first()
        .click();
      await seller.waitForLoadState('networkidle');
      await seller.getByRole('button', { name: step.action }).click();
      // The success message disappears when the form re-renders for the next step; check the result.
      await expect(seller.getByRole('dialog').getByText(step.status)).toBeVisible({
        timeout: 30_000,
      });
      await gotoHydrated(buyer, '/purchases');
      await expect(buyer.getByText(step.status).first()).toBeVisible();
    }
  } finally {
    await sellerContext.close();
    await buyerContext.close();
  }
});
