import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssignCustomerToCartUseCase } from '@/carts/application/use-cases/assign-customer-to-cart.use-case';
import { InMemoryCartRepository } from '@/testing/in-memory/in-memory-cart.repository';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { buildCart } from '@/testing/builders/cart.builder';
import { createCartId } from '@/carts/domain/types/cart-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { CartStatus } from '@/carts/domain/enums/cart-status.enum';
import { CartNotFoundException } from '@/carts/application/exceptions/cart-not-found.exception';
import { InvalidCartStateException } from '@/carts/domain/exceptions/invalid-cart-state.exception';
import type { Cart } from '@/carts/domain/entities/cart.entity';
import { createCustomerId } from '@/carts/domain/types/customer-id.type';
import { InvalidCartAttributeException } from '@/carts/domain/exceptions/invalid-cart-attribute.exception';

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';
const CART_ID = 'cart-1';
const NOW = new Date('2026-01-15T12:00:00.000Z');

interface Harness {
  repo: InMemoryCartRepository;
  bus: FakeEventBus;
  useCase: AssignCustomerToCartUseCase;
}

function setup(): Harness {
  const repo = new InMemoryCartRepository();
  const bus = new FakeEventBus();
  return { repo, bus, useCase: new AssignCustomerToCartUseCase(repo, bus) };
}

async function load(repo: InMemoryCartRepository, tenant: string = TENANT): Promise<Cart | null> {
  return repo.findById(createCartId(CART_ID), createTenantId(tenant));
}

describe('AssignCustomerToCartUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('assigns the customer and saves; Cart.assignCustomer raises no event', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildCart());

    await useCase.execute({ cartId: CART_ID, tenantId: TENANT, customerId: 'customer-1' });

    const stored = await load(repo);
    expect(stored?.getCustomerId()).toBe('customer-1');
    expect(stored?.getVersion()).toBe(1);
    expect(repo.saveCount).toBe(1);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('replaces a previously assigned customer', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildCart({ customerId: createCustomerId('customer-0') }));

    await useCase.execute({ cartId: CART_ID, tenantId: TENANT, customerId: 'customer-1' });

    expect((await load(repo))?.getCustomerId()).toBe('customer-1');
  });

  it('rejects an empty customer id and leaves the cart unchanged', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildCart());

    await expect((): Promise<void> =>
      useCase.execute({ cartId: CART_ID, tenantId: TENANT, customerId: '  ' }),
    ).rejects.toBeInstanceOf(InvalidCartAttributeException);

    expect((await load(repo))?.getCustomerId()).toBeNull();
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('throws CartNotFoundException for an unknown cart and writes nothing', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();

    await expect((): Promise<unknown> =>
      useCase.execute({ cartId: CART_ID, tenantId: TENANT, customerId: 'customer-1' }),
    ).rejects.toBeInstanceOf(CartNotFoundException);

    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it("treats another tenant's cart as not found and leaves it unchanged", async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildCart());

    await expect((): Promise<unknown> =>
      useCase.execute({ cartId: CART_ID, tenantId: OTHER_TENANT, customerId: 'customer-1' }),
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
        useCase.execute({ cartId: CART_ID, tenantId: TENANT, customerId: 'customer-1' }),
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
      useCase.execute({ cartId: CART_ID, tenantId: TENANT, customerId: 'customer-1' }),
    ).rejects.toBeInstanceOf(InvalidCartStateException);

    expect((await load(repo))?.getStatus()).toBe(CartStatus.ACTIVE);
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });
});
