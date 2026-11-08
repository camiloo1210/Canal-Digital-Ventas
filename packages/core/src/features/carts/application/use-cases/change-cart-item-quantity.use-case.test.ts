import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeCartItemQuantityUseCase } from '@/carts/application/use-cases/change-cart-item-quantity.use-case';
import { InMemoryCartRepository } from '@/testing/in-memory/in-memory-cart.repository';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { buildCart, buildCartItem } from '@/testing/builders/cart.builder';
import { createCartId } from '@/carts/domain/types/cart-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { CartStatus } from '@/carts/domain/enums/cart-status.enum';
import { CartNotFoundException } from '@/carts/application/exceptions/cart-not-found.exception';
import { InvalidCartStateException } from '@/carts/domain/exceptions/invalid-cart-state.exception';
import type { Cart } from '@/carts/domain/entities/cart.entity';
import { InvalidCartAttributeException } from '@/carts/domain/exceptions/invalid-cart-attribute.exception';
import { InvalidCartItemQuantityException } from '@/carts/domain/exceptions/invalid-cart-item-quantity.exception';

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';
const CART_ID = 'cart-1';
const NOW = new Date('2026-01-15T12:00:00.000Z');

interface Harness {
  repo: InMemoryCartRepository;
  bus: FakeEventBus;
  useCase: ChangeCartItemQuantityUseCase;
}

function setup(): Harness {
  const repo = new InMemoryCartRepository();
  const bus = new FakeEventBus();
  return { repo, bus, useCase: new ChangeCartItemQuantityUseCase(repo, bus) };
}

async function load(repo: InMemoryCartRepository, tenant: string = TENANT): Promise<Cart | null> {
  return repo.findById(createCartId(CART_ID), createTenantId(tenant));
}

describe('ChangeCartItemQuantityUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('changes the quantity, recalculates the subtotal and saves', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildCart());

    await useCase.execute({ cartId: CART_ID, tenantId: TENANT, itemId: 'item-1', quantity: 5 });

    const stored = await load(repo);
    expect(stored?.getItems()[0].getQuantity()).toBe(5);
    expect(stored?.getItems()[0].getSubtotal().getValue()).toBe(50);
    expect(stored?.getSubtotal().getValue()).toBe(50);
    expect(stored?.getVersion()).toBe(1);
    expect(repo.saveCount).toBe(1);
    // Cart.changeItemQuantity() raises no domain event.
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('only changes the targeted item', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(
      buildCart({ items: [buildCartItem('item-1', 2), buildCartItem('item-2', 3, 'product-2')] }),
    );

    await useCase.execute({ cartId: CART_ID, tenantId: TENANT, itemId: 'item-1', quantity: 5 });

    const stored = await load(repo);
    expect(stored?.getItems().map((item): number => item.getQuantity())).toEqual([5, 3]);
    expect(stored?.getSubtotal().getValue()).toBe(80);
  });

  it.each([0, -1, 1.5, Number.NaN])(
    'rejects quantity %s with InvalidCartItemQuantityException and leaves the cart unchanged',
    async (quantity): Promise<void> => {
      const { repo, bus, useCase } = setup();
      repo.seed(buildCart());

      await expect((): Promise<void> =>
        useCase.execute({ cartId: CART_ID, tenantId: TENANT, itemId: 'item-1', quantity }),
      ).rejects.toBeInstanceOf(InvalidCartItemQuantityException);

      const stored = await load(repo);
      expect(stored?.getItems()[0].getQuantity()).toBe(2);
      expect(stored?.getSubtotal().getValue()).toBe(20);
      expect(stored?.getVersion()).toBe(0);
      expect(repo.saveCount).toBe(0);
      expect(bus.publishedLegacy).toHaveLength(0);
    },
  );

  it('does not check product stock: the cart accepts any positive integer quantity (current behavior)', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildCart());

    await useCase.execute({
      cartId: CART_ID,
      tenantId: TENANT,
      itemId: 'item-1',
      quantity: 100000,
    });

    expect((await load(repo))?.getItems()[0].getQuantity()).toBe(100000);
  });

  it('rejects an item that is not in the cart and leaves the cart unchanged', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildCart());

    await expect((): Promise<void> =>
      useCase.execute({ cartId: CART_ID, tenantId: TENANT, itemId: 'ghost', quantity: 3 }),
    ).rejects.toBeInstanceOf(InvalidCartAttributeException);

    expect((await load(repo))?.getVersion()).toBe(0);
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('throws CartNotFoundException for an unknown cart and writes nothing', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();

    await expect((): Promise<unknown> =>
      useCase.execute({ cartId: CART_ID, tenantId: TENANT, itemId: 'item-1', quantity: 4 }),
    ).rejects.toBeInstanceOf(CartNotFoundException);

    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it("treats another tenant's cart as not found and leaves it unchanged", async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildCart());

    await expect((): Promise<unknown> =>
      useCase.execute({ cartId: CART_ID, tenantId: OTHER_TENANT, itemId: 'item-1', quantity: 4 }),
    ).rejects.toBeInstanceOf(CartNotFoundException);

    const untouched = await load(repo);
    expect(untouched?.getStatus()).toBe(CartStatus.ACTIVE);
    expect(untouched?.getVersion()).toBe(0);
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it.each([CartStatus.COMPLETED, CartStatus.ABANDONED])(
    'rejects a %s cart with InvalidCartStateException and saves nothing',
    async (status): Promise<void> => {
      const { repo, bus, useCase } = setup();
      repo.seed(buildCart({ status }));

      await expect((): Promise<unknown> =>
        useCase.execute({ cartId: CART_ID, tenantId: TENANT, itemId: 'item-1', quantity: 4 }),
      ).rejects.toBeInstanceOf(InvalidCartStateException);

      expect((await load(repo))?.getStatus()).toBe(status);
      expect(repo.saveCount).toBe(0);
      expect(bus.publishedLegacy).toHaveLength(0);
    },
  );

  it('rejects an expired cart and does not persist the implicit abandon', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildCart({ expiresAt: new Date('2026-01-15T11:59:59.000Z') }));

    await expect((): Promise<unknown> =>
      useCase.execute({ cartId: CART_ID, tenantId: TENANT, itemId: 'item-1', quantity: 4 }),
    ).rejects.toBeInstanceOf(InvalidCartStateException);

    expect((await load(repo))?.getStatus()).toBe(CartStatus.ACTIVE);
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });
});
