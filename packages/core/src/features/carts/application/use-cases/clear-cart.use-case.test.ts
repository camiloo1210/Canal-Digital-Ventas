import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClearCartUseCase } from '@/carts/application/use-cases/clear-cart.use-case';
import { InMemoryCartRepository } from '@/testing/in-memory/in-memory-cart.repository';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { buildCart, buildCartItem } from '@/testing/builders/cart.builder';
import { createCartId } from '@/carts/domain/types/cart-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { CartStatus } from '@/carts/domain/enums/cart-status.enum';
import { CartNotFoundException } from '@/carts/application/exceptions/cart-not-found.exception';
import { InvalidCartStateException } from '@/carts/domain/exceptions/invalid-cart-state.exception';
import type { Cart } from '@/carts/domain/entities/cart.entity';

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';
const CART_ID = 'cart-1';
const NOW = new Date('2026-01-15T12:00:00.000Z');

interface Harness {
  repo: InMemoryCartRepository;
  bus: FakeEventBus;
  useCase: ClearCartUseCase;
}

function setup(): Harness {
  const repo = new InMemoryCartRepository();
  const bus = new FakeEventBus();
  return { repo, bus, useCase: new ClearCartUseCase(repo, bus) };
}

async function load(repo: InMemoryCartRepository, tenant: string = TENANT): Promise<Cart | null> {
  return repo.findById(createCartId(CART_ID), createTenantId(tenant));
}

describe('ClearCartUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('removes every item, resets the subtotal to zero and saves', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(
      buildCart({ items: [buildCartItem('item-1', 2), buildCartItem('item-2', 1, 'product-2')] }),
    );

    await useCase.execute({ cartId: CART_ID, tenantId: TENANT });

    const stored = await load(repo);
    expect(stored?.getItems()).toHaveLength(0);
    expect(stored?.getSubtotal().getValue()).toBe(0);
    expect(stored?.getStatus()).toBe(CartStatus.ACTIVE);
    expect(stored?.getVersion()).toBe(1);
    expect(repo.saveCount).toBe(1);
    // Cart.clear() raises no domain event.
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('clearing an already empty cart succeeds', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildCart({ items: [] }));

    await useCase.execute({ cartId: CART_ID, tenantId: TENANT });

    expect((await load(repo))?.getItems()).toHaveLength(0);
    expect(repo.saveCount).toBe(1);
  });

  it('does not touch the carts of another tenant', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildCart(), buildCart({ tenantId: createTenantId(OTHER_TENANT) }));

    await useCase.execute({ cartId: CART_ID, tenantId: TENANT });

    expect((await load(repo, OTHER_TENANT))?.getItems()).toHaveLength(1);
  });

  it('throws CartNotFoundException for an unknown cart and writes nothing', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();

    await expect((): Promise<unknown> =>
      useCase.execute({ cartId: CART_ID, tenantId: TENANT }),
    ).rejects.toBeInstanceOf(CartNotFoundException);

    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it("treats another tenant's cart as not found and leaves it unchanged", async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildCart());

    await expect((): Promise<unknown> =>
      useCase.execute({ cartId: CART_ID, tenantId: OTHER_TENANT }),
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
        useCase.execute({ cartId: CART_ID, tenantId: TENANT }),
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
      useCase.execute({ cartId: CART_ID, tenantId: TENANT }),
    ).rejects.toBeInstanceOf(InvalidCartStateException);

    expect((await load(repo))?.getStatus()).toBe(CartStatus.ACTIVE);
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });
});
