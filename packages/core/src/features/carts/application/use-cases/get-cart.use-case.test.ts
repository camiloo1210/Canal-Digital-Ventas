import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GetCartUseCase } from '@/carts/application/use-cases/get-cart.use-case';
import { InMemoryCartRepository } from '@/testing/in-memory/in-memory-cart.repository';
import { buildCart, buildCartItem } from '@/testing/builders/cart.builder';
import { createCartId } from '@/carts/domain/types/cart-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { CartStatus } from '@/carts/domain/enums/cart-status.enum';
import { CartNotFoundException } from '@/carts/application/exceptions/cart-not-found.exception';
import { InvalidCartAttributeException } from '@/carts/domain/exceptions/invalid-cart-attribute.exception';

const NOW = new Date('2026-01-15T12:00:00.000Z');

function setup(): { repo: InMemoryCartRepository; useCase: GetCartUseCase } {
  const repo = new InMemoryCartRepository();
  return { repo, useCase: new GetCartUseCase(repo) };
}

describe('GetCartUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('returns the cart with its items and subtotal', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(
      buildCart({ items: [buildCartItem('item-1', 2), buildCartItem('item-2', 1, 'product-2')] }),
    );

    const cart = await useCase.execute({ cartId: 'cart-1', tenantId: 'tenant-1' });

    expect(cart.getId()).toBe('cart-1');
    expect(cart.getItems()).toHaveLength(2);
    expect(cart.getSubtotal().getValue()).toBe(30);
    expect(cart.getStatus()).toBe(CartStatus.ACTIVE);
  });

  it('returns carts in any status (reads are not restricted to active carts)', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildCart({ status: CartStatus.COMPLETED }));

    const cart = await useCase.execute({ cartId: 'cart-1', tenantId: 'tenant-1' });

    expect(cart.getStatus()).toBe(CartStatus.COMPLETED);
  });

  it('throws CartNotFoundException for an unknown cart', async (): Promise<void> => {
    const { useCase } = setup();

    await expect((): Promise<unknown> =>
      useCase.execute({ cartId: 'missing', tenantId: 'tenant-1' }),
    ).rejects.toBeInstanceOf(CartNotFoundException);
  });

  it("treats another tenant's cart as not found", async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildCart());

    await expect((): Promise<unknown> =>
      useCase.execute({ cartId: 'cart-1', tenantId: 'tenant-2' }),
    ).rejects.toBeInstanceOf(CartNotFoundException);
  });

  it('returns only the cart of the requested tenant when ids collide', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildCart(), buildCart({ tenantId: createTenantId('tenant-2'), items: [] }));

    expect(
      (await useCase.execute({ cartId: 'cart-1', tenantId: 'tenant-1' })).getItems(),
    ).toHaveLength(1);
    expect(
      (await useCase.execute({ cartId: 'cart-1', tenantId: 'tenant-2' })).getItems(),
    ).toHaveLength(0);
  });

  it('returns a fresh instance: mutating it does not change the stored cart', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildCart());

    const cart = await useCase.execute({ cartId: 'cart-1', tenantId: 'tenant-1' });
    cart.clear();

    const stored = await repo.findById(createCartId('cart-1'), createTenantId('tenant-1'));
    expect(stored?.getItems()).toHaveLength(1);
    expect(repo.saveCount).toBe(0);
  });

  it('rejects an empty cart id', async (): Promise<void> => {
    const { useCase } = setup();

    await expect((): Promise<unknown> =>
      useCase.execute({ cartId: ' ', tenantId: 'tenant-1' }),
    ).rejects.toBeInstanceOf(InvalidCartAttributeException);
  });
});
