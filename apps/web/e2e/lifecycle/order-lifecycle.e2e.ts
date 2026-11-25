import { expect, test, type Page } from '@playwright/test';
import { BUYER_STATE, SELLER_STATE } from '@/e2e/support/paths';
import { gotoHydrated } from '@/e2e/support/navigation';
import { markConfirmedOrdersPaidWithoutPayment } from '@/e2e/support/simulated-payment';
import { actors, catalog, readRunId } from '@/e2e/support/test-data';

const runId = readRunId();
const data = catalog(runId);
const slug = actors(runId).seller.storeSlug;
const NO_NEXT_STEP = 'Este pedido no tiene un avance logístico disponible.';

/**
 * One order, followed from both sides. Each step uses Playwright's own `page` (one role per test),
 * so the UI mode shows every action. The tests share state and must run in this order.
 *
 * PAYMENT IS SIMULATED, NOT TESTED: step 3 marks the order paid directly in the local database
 * (see support/simulated-payment.ts). Lemon Squeezy is NOT covered by this file.
 */
test.describe.configure({ mode: 'serial', timeout: 120_000 });

type Role = 'seller' | 'buyer';

function step(role: Role, title: string, body: (page: Page) => Promise<void>): void {
  test.describe(title, (): void => {
    test.use({ storageState: role === 'seller' ? SELLER_STATE : BUYER_STATE });
    test(`as ${role}`, async ({ page }): Promise<void> => {
      await body(page);
    });
  });
}

async function openSellerOrder(page: Page): Promise<void> {
  await gotoHydrated(page, '/dashboard/orders');
  await page
    .getByRole('row', { name: /Comprador Prueba/ })
    .getByRole('link')
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

async function sellerAdvances(page: Page, action: string, status: string): Promise<void> {
  await openSellerOrder(page);
  await page.getByRole('button', { name: action }).click();
  // The success message disappears when the form re-renders; check the resulting status instead.
  await expect(page.getByRole('dialog').getByText(status)).toBeVisible({ timeout: 30_000 });
}

async function buyerSees(page: Page, status: string): Promise<void> {
  await gotoHydrated(page, '/purchases');
  await expect(page.getByText(data.productName).first()).toBeVisible();
  await expect(page.getByText(status).first()).toBeVisible();
}

step('seller', '1. seller sees the confirmed order and no logistics step', async (page) => {
  await gotoHydrated(page, '/dashboard/orders');
  await expect(page.getByRole('row', { name: /Comprador Prueba/ })).toContainText('Confirmado');
  await openSellerOrder(page);
  await expect(page.getByText(data.productName).first()).toBeVisible();
  await expect(page.getByText(NO_NEXT_STEP)).toBeVisible();
});

step('buyer', '2. buyer sees the order as confirmed', (page) => buyerSees(page, 'Confirmado'));

test('3. payment is simulated in the local database (NOT tested)', async (): Promise<void> => {
  expect(await markConfirmedOrdersPaidWithoutPayment(slug)).toBe(1);
});

step('buyer', '4. buyer sees the order as paid', (page) => buyerSees(page, 'Pagado'));

step('seller', '5. seller starts preparing the order', (page) =>
  sellerAdvances(page, 'Comenzar preparación', 'En Proceso'),
);

step('buyer', '6. buyer sees the order in process', (page) => buyerSees(page, 'En Proceso'));

step('seller', '7. seller ships the order', (page) =>
  sellerAdvances(page, 'Marcar como enviado', 'Enviado'),
);

step('buyer', '8. buyer sees the order shipped', (page) => buyerSees(page, 'Enviado'));

step('seller', '9. seller marks the order delivered', (page) =>
  sellerAdvances(page, 'Marcar como entregado', 'Entregado'),
);

step('buyer', '10. buyer sees the order delivered', (page) => buyerSees(page, 'Entregado'));

step('seller', '11. a delivered order has no further logistics step', async (page) => {
  await openSellerOrder(page);
  await expect(page.getByText(NO_NEXT_STEP)).toBeVisible();
});
