import { describe, expect, it, vi } from 'vitest';
import { CreateCartUseCase } from '@/carts/application/use-cases/create-cart.use-case';
import { AddItemToCartUseCase } from '@/carts/application/use-cases/add-item-to-cart.use-case';
import { CartRepositoryPort } from '@/carts/application/ports/out/cart-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { Cart } from '@/carts/domain/entities/cart.entity';

function setup(): { repo: CartRepositoryPort; saved: Cart[]; bus: EventBusPort } {
  const saved: Cart[] = [];
  const repo = {
    save: vi.fn(async (cart: Cart): Promise<void> => {
      saved.push(cart);
    }),
    findById: vi.fn(async (): Promise<Cart | null> => saved[saved.length - 1] ?? null),
  } as unknown as CartRepositoryPort;
  const bus = { publish: vi.fn(async (): Promise<void> => undefined) } as unknown as EventBusPort;
  return { repo, saved, bus };
}

describe('cart currency in use cases', (): void => {
  it('creates a CLP cart and adds an item at face value in the cart currency', async (): Promise<void> => {
    const { repo, saved, bus } = setup();
    await new CreateCartUseCase(repo, bus).execute({
      id: 'cart',
      tenantId: 'tenant',
      customerId: null,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      currency: 'CLP',
    });
    await new AddItemToCartUseCase(repo, bus).execute({
      cartId: 'cart',
      tenantId: 'tenant',
      productId: 'product',
      productName: 'Item',
      sku: 'SKU',
      quantity: 1,
      unitPriceValue: 5000,
    });
    const cart = saved[saved.length - 1];
    expect(cart.getSubtotal().getCurrency()).toBe('CLP');
    expect(cart.getSubtotal().getValue()).toBe(5000);
  });
  it('rejects an unsupported currency when creating a cart', async (): Promise<void> => {
    const { repo, bus } = setup();
    await expect(
      new CreateCartUseCase(repo, bus).execute({
        id: 'cart',
        tenantId: 'tenant',
        customerId: null,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        currency: 'XXX',
      }),
    ).rejects.toThrow();
  });
});
