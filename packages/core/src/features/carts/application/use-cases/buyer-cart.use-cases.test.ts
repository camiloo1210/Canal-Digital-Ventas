import { describe, expect, it } from 'vitest';
import {
  NOW,
  TENANT_ID,
  TENANT_SLUG,
  USER_ID,
  catalogProduct,
  harness,
  productId,
  type Harness,
} from '@/carts/application/buyer-cart-test-doubles';
import { SyncBuyerCartUseCase } from '@/carts/application/use-cases/sync-buyer-cart.use-case';
import { MergeBuyerCartUseCase } from '@/carts/application/use-cases/merge-buyer-cart.use-case';
import { GetBuyerCartUseCase } from '@/carts/application/use-cases/get-buyer-cart.use-case';
import { CompleteBuyerCartUseCase } from '@/carts/application/use-cases/complete-buyer-cart.use-case';
import { CartVersionConflictException } from '@/carts/application/exceptions/cart-version-conflict.exception';
import { BuyerCartStoreNotFoundException } from '@/carts/application/exceptions/buyer-cart-store-not-found.exception';
import { InvalidBuyerCartInputException } from '@/carts/application/exceptions/invalid-buyer-cart-input.exception';
import {
  BUYER_CART_TTL_DAYS,
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
} from '@/carts/domain/policies/buyer-cart-limits';

const DAY = 86_400_000;

function sync(h: Harness): SyncBuyerCartUseCase {
  return new SyncBuyerCartUseCase(h.carts, h.catalog, h.transactions, (): Date => h.clock.now);
}
function merge(h: Harness): MergeBuyerCartUseCase {
  return new MergeBuyerCartUseCase(h.carts, h.catalog, h.transactions, (): Date => h.clock.now);
}
function get(h: Harness): GetBuyerCartUseCase {
  return new GetBuyerCartUseCase(h.carts, h.catalog, h.transactions, (): Date => h.clock.now);
}

describe('SyncBuyerCartUseCase', (): void => {
  it('creates the cart with catalog data, not client data, and slides the expiry', async (): Promise<void> => {
    const h = harness([
      catalogProduct(1, { name: 'Real', unitPriceCents: 4200, imageUrl: 'i.jpg' }),
    ]);
    const dto = {
      userId: USER_ID,
      tenantSlug: TENANT_SLUG,
      baseVersion: null,
      items: [{ productId: productId(1), quantity: 2, unitPriceCents: 1, name: 'Fake' }],
    };
    const result = await sync(h).execute(dto);
    expect(result.cart.items).toEqual([
      {
        productId: productId(1),
        name: 'Real',
        sku: 'SKU-1',
        unitPriceCents: 4200,
        retailPriceCents: 4200,
        currency: 'COP',
        wholesalePriceCents: null,
        wholesaleMinQuantity: null,
        quantity: 2,
        maxQuantity: 99,
        imageUrl: 'i.jpg',
      },
    ]);
    expect(result.cart.version).toBe(1);
    expect(result.cart.expiresAt).toBe(
      new Date(NOW.getTime() + BUYER_CART_TTL_DAYS * DAY).toISOString(),
    );
    const stored = h.carts.carts.values().next().value;
    expect(stored?.lines[0]).toMatchObject({ name: 'Real', unitPriceCents: 4200 });
    expect(h.transactions.calls).toEqual([{ userId: USER_ID, tenantId: TENANT_ID }]);
    expect(h.carts.locks).toEqual([true]);
  });

  it('drops inactive products, reports out of stock, clamps to stock and to 99, and dedupes by max', async (): Promise<void> => {
    const h = harness([
      catalogProduct(1, { availableQuantity: 5 }),
      catalogProduct(2, { availableQuantity: 0 }),
      catalogProduct(3, { availableQuantity: 1000 }),
    ]);
    const result = await sync(h).execute({
      userId: USER_ID,
      tenantSlug: TENANT_SLUG,
      baseVersion: null,
      items: [
        { productId: productId(1), quantity: 50 },
        { productId: productId(2), quantity: 1 },
        { productId: productId(9), quantity: 1 },
        { productId: productId(3), quantity: 3 },
        { productId: productId(3), quantity: 1000 },
        { productId: productId(1), quantity: 2 },
        { productId: 'not-a-uuid', quantity: 0 },
      ],
    });
    expect(
      result.cart.items.map((i): [string, number, number] => [
        i.productId,
        i.quantity,
        i.maxQuantity,
      ]),
    ).toEqual([
      [productId(1), 5, 5],
      [productId(3), MAX_LINE_QUANTITY, MAX_LINE_QUANTITY],
    ]);
    expect(result.dropped).toEqual([
      { productId: productId(2), reason: 'out_of_stock' },
      { productId: productId(9), reason: 'unavailable' },
      { productId: 'not-a-uuid', reason: 'unavailable' },
    ]);
  });

  it('sanitizes non-positive and non-finite quantities to at least 1', async (): Promise<void> => {
    const h = harness([catalogProduct(1), catalogProduct(2)]);
    const result = await sync(h).execute({
      userId: USER_ID,
      tenantSlug: TENANT_SLUG,
      baseVersion: null,
      items: [
        { productId: productId(1), quantity: -4 },
        { productId: productId(2), quantity: Number.NaN },
      ],
    });
    expect(result.cart.items.map((i): number => i.quantity)).toEqual([1, 1]);
  });

  it('caps the cart at MAX_CART_LINES and reports the rest as limit', async (): Promise<void> => {
    const products = Array.from(
      { length: MAX_CART_LINES + 3 },
      (_v, i): ReturnType<typeof catalogProduct> => catalogProduct(i + 1),
    );
    const h = harness(products);
    const result = await sync(h).execute({
      userId: USER_ID,
      tenantSlug: TENANT_SLUG,
      baseVersion: null,
      items: products.map((p): { productId: string; quantity: number } => ({
        productId: p.productId,
        quantity: 1,
      })),
    });
    expect(result.cart.items).toHaveLength(MAX_CART_LINES);
    expect(result.dropped).toEqual(
      [51, 52, 53].map((n): { productId: string; reason: 'limit' } => ({
        productId: productId(n),
        reason: 'limit',
      })),
    );
  });

  it('rejects an unknown store with a typed exception', async (): Promise<void> => {
    const h = harness([]);
    await expect(
      sync(h).execute({ userId: USER_ID, tenantSlug: 'nope', baseVersion: null, items: [] }),
    ).rejects.toBeInstanceOf(BuyerCartStoreNotFoundException);
  });

  it('rejects a missing identity and an invalid base version', async (): Promise<void> => {
    const h = harness([]);
    await expect(
      sync(h).execute({ userId: '', tenantSlug: TENANT_SLUG, baseVersion: null, items: [] }),
    ).rejects.toBeInstanceOf(InvalidBuyerCartInputException);
    await expect(
      sync(h).execute({ userId: USER_ID, tenantSlug: TENANT_SLUG, baseVersion: -1, items: [] }),
    ).rejects.toBeInstanceOf(InvalidBuyerCartInputException);
  });

  it('enforces optimistic concurrency and carries the server cart', async (): Promise<void> => {
    const h = harness([catalogProduct(1), catalogProduct(2)]);
    const base = { userId: USER_ID, tenantSlug: TENANT_SLUG };
    await sync(h).execute({
      ...base,
      baseVersion: null,
      items: [{ productId: productId(1), quantity: 1 }],
    });

    await expect(
      sync(h).execute({
        ...base,
        baseVersion: null,
        items: [{ productId: productId(2), quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(CartVersionConflictException);
    const error = await sync(h)
      .execute({ ...base, baseVersion: 7, items: [] })
      .catch((e: unknown): unknown => e);
    expect(error).toBeInstanceOf(CartVersionConflictException);
    expect((error as CartVersionConflictException).serverCart.version).toBe(1);
    expect((error as CartVersionConflictException).serverCart.items).toHaveLength(1);

    const ok = await sync(h).execute({
      ...base,
      baseVersion: 1,
      items: [{ productId: productId(2), quantity: 3 }],
    });
    expect(ok.cart.version).toBe(2);
  });

  it('accepts base version 0 (or null) when there is no stored cart but conflicts on a stale base', async (): Promise<void> => {
    const h = harness([catalogProduct(1)]);
    const result = await sync(h).execute({
      userId: USER_ID,
      tenantSlug: TENANT_SLUG,
      baseVersion: 0,
      items: [{ productId: productId(1), quantity: 1 }],
    });
    expect(result.cart.version).toBe(1);
  });

  it('maps a concurrent create race to a version conflict', async (): Promise<void> => {
    const h = harness([catalogProduct(1)]);
    h.carts.failNextSaveWithConflict = true;
    await expect(
      sync(h).execute({
        userId: USER_ID,
        tenantSlug: TENANT_SLUG,
        baseVersion: null,
        items: [{ productId: productId(1), quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(CartVersionConflictException);
  });

  it('is idempotent for identical snapshots: same version, only the expiry slides', async (): Promise<void> => {
    const h = harness([catalogProduct(1)]);
    const dto = {
      userId: USER_ID,
      tenantSlug: TENANT_SLUG,
      items: [{ productId: productId(1), quantity: 2 }],
    };
    const first = await sync(h).execute({ ...dto, baseVersion: null });
    h.clock.now = new Date(NOW.getTime() + 10 * DAY);
    const second = await sync(h).execute({ ...dto, baseVersion: first.cart.version });
    expect(second.cart.version).toBe(first.cart.version);
    expect(h.carts.saves).toBe(1);
    expect(h.carts.touches).toBe(1);
    expect(second.cart.expiresAt).toBe(
      new Date(h.clock.now.getTime() + BUYER_CART_TTL_DAYS * DAY).toISOString(),
    );
  });

  it('clears the cart on empty items keeping the row, bumping the version', async (): Promise<void> => {
    const h = harness([catalogProduct(1)]);
    const base = { userId: USER_ID, tenantSlug: TENANT_SLUG };
    await sync(h).execute({
      ...base,
      baseVersion: null,
      items: [{ productId: productId(1), quantity: 1 }],
    });
    h.clock.now = new Date(NOW.getTime() + DAY);
    const cleared = await sync(h).execute({ ...base, baseVersion: 1, items: [] });
    expect(cleared.cart.items).toEqual([]);
    expect(cleared.cart.version).toBe(2);
    expect(h.carts.carts.size).toBe(1);
    expect([...h.carts.carts.values()][0].expiresAt.getTime()).toBe(
      h.clock.now.getTime() + BUYER_CART_TTL_DAYS * DAY,
    );
  });

  it('does not create a row for an empty snapshot without server state', async (): Promise<void> => {
    const h = harness([]);
    const result = await sync(h).execute({
      userId: USER_ID,
      tenantSlug: TENANT_SLUG,
      baseVersion: null,
      items: [],
    });
    expect(result.cart.version).toBe(0);
    expect(h.carts.carts.size).toBe(0);
  });

  it('treats an expired cart as absent and reuses its row', async (): Promise<void> => {
    const h = harness([catalogProduct(1)]);
    h.carts.seed({
      id: 'old',
      tenantId: TENANT_ID,
      buyerUserId: USER_ID,
      lines: [],
      version: 7,
      updatedAt: new Date(NOW.getTime() - 40 * DAY),
      expiresAt: new Date(NOW.getTime() - 10 * DAY),
    });
    const result = await sync(h).execute({
      userId: USER_ID,
      tenantSlug: TENANT_SLUG,
      baseVersion: null,
      items: [{ productId: productId(1), quantity: 1 }],
    });
    expect(result.cart.version).toBe(8);
    expect(result.cart.items).toHaveLength(1);
  });
});

describe('MergeBuyerCartUseCase', (): void => {
  it('unions server and guest lines taking the max quantity, and is idempotent', async (): Promise<void> => {
    const h = harness([catalogProduct(1), catalogProduct(2), catalogProduct(3)]);
    const base = { userId: USER_ID, tenantSlug: TENANT_SLUG };
    await sync(h).execute({
      ...base,
      baseVersion: null,
      items: [
        { productId: productId(1), quantity: 5 },
        { productId: productId(2), quantity: 1 },
      ],
    });
    const guest = [
      { productId: productId(2), quantity: 4 },
      { productId: productId(1), quantity: 2 },
      { productId: productId(3), quantity: 1 },
    ];
    const merged = await merge(h).execute({ ...base, items: guest });
    expect(merged.cart.items.map((i): [string, number] => [i.productId, i.quantity])).toEqual([
      [productId(1), 5],
      [productId(2), 4],
      [productId(3), 1],
    ]);
    expect(merged.cart.version).toBe(2);
    const again = await merge(h).execute({ ...base, items: guest });
    expect(again.cart.version).toBe(2);
    expect(again.cart.items).toEqual(merged.cart.items);
    expect(h.carts.saves).toBe(2);
  });

  it('normalizes the guest lines like sync does', async (): Promise<void> => {
    const h = harness([
      catalogProduct(1, { availableQuantity: 3 }),
      catalogProduct(2, { availableQuantity: 0 }),
    ]);
    const result = await merge(h).execute({
      userId: USER_ID,
      tenantSlug: TENANT_SLUG,
      items: [
        { productId: productId(1), quantity: 10 },
        { productId: productId(2), quantity: 1 },
      ],
    });
    expect(result.cart.items.map((i): number => i.quantity)).toEqual([3]);
    expect(result.dropped).toEqual([{ productId: productId(2), reason: 'out_of_stock' }]);
  });

  it('keeps server lines first when the line cap is hit', async (): Promise<void> => {
    const products = Array.from(
      { length: MAX_CART_LINES + 1 },
      (_v, i): ReturnType<typeof catalogProduct> => catalogProduct(i + 1),
    );
    const h = harness(products);
    const base = { userId: USER_ID, tenantSlug: TENANT_SLUG };
    await sync(h).execute({
      ...base,
      baseVersion: null,
      items: products
        .slice(0, MAX_CART_LINES)
        .map((p): { productId: string; quantity: number } => ({
          productId: p.productId,
          quantity: 1,
        })),
    });
    const merged = await merge(h).execute({
      ...base,
      items: [{ productId: productId(MAX_CART_LINES + 1), quantity: 1 }],
    });
    expect(merged.cart.items).toHaveLength(MAX_CART_LINES);
    expect(merged.dropped).toEqual([{ productId: productId(MAX_CART_LINES + 1), reason: 'limit' }]);
  });
});

describe('GetBuyerCartUseCase', (): void => {
  it('returns an empty version-0 cart when none exists', async (): Promise<void> => {
    const h = harness([]);
    const cart = await get(h).execute({ userId: USER_ID, tenantSlug: TENANT_SLUG });
    expect(cart.items).toEqual([]);
    expect(cart.version).toBe(0);
  });

  it('refreshes names, prices and stock from the catalog and treats expiry as empty', async (): Promise<void> => {
    const h = harness([catalogProduct(1, { unitPriceCents: 9999, availableQuantity: 2 })]);
    h.carts.seed({
      id: 'c',
      tenantId: TENANT_ID,
      buyerUserId: USER_ID,
      lines: [{ productId: productId(1), name: 'Old', sku: 'OLD', unitPriceCents: 1, quantity: 6 }],
      version: 3,
      updatedAt: NOW,
      expiresAt: new Date(NOW.getTime() + DAY),
    });
    const cart = await get(h).execute({ userId: USER_ID, tenantSlug: TENANT_SLUG });
    expect(cart.version).toBe(3);
    expect(cart.items[0]).toMatchObject({ unitPriceCents: 9999, quantity: 2, maxQuantity: 2 });

    h.clock.now = new Date(NOW.getTime() + 2 * DAY);
    const expired = await get(h).execute({ userId: USER_ID, tenantSlug: TENANT_SLUG });
    expect(expired.items).toEqual([]);
    expect(expired.version).toBe(0);
  });

  it('rejects an unknown store', async (): Promise<void> => {
    const h = harness([]);
    await expect(get(h).execute({ userId: USER_ID, tenantSlug: 'x' })).rejects.toBeInstanceOf(
      BuyerCartStoreNotFoundException,
    );
  });
});

describe('CompleteBuyerCartUseCase', (): void => {
  it('marks the active cart converted and is safe without a cart', async (): Promise<void> => {
    const h = harness([catalogProduct(1)]);
    const complete = new CompleteBuyerCartUseCase(h.carts, h.transactions, (): Date => h.clock.now);
    await expect(
      complete.execute({ userId: USER_ID, tenantId: TENANT_ID }),
    ).resolves.toBeUndefined();
    await sync(h).execute({
      userId: USER_ID,
      tenantSlug: TENANT_SLUG,
      baseVersion: null,
      items: [{ productId: productId(1), quantity: 1 }],
    });
    await complete.execute({ userId: USER_ID, tenantId: TENANT_ID });
    expect([...h.carts.carts.values()][0].status).toBe('converted');
    const fresh = await get(h).execute({ userId: USER_ID, tenantSlug: TENANT_SLUG });
    expect(fresh.items).toEqual([]);
  });
});
