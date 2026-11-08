import { Cart, type CartProps } from '@/carts/domain/entities/cart.entity';
import { CartItem } from '@/carts/domain/entities/cart-item.entity';
import { CartStatus } from '@/carts/domain/enums/cart-status.enum';
import { createCartId } from '@/carts/domain/types/cart-id.type';
import { createCartItemId } from '@/carts/domain/types/cart-item-id.type';
import { createProductId } from '@/carts/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { DEFAULT_TEST_TENANT_ID } from '@/testing/builders/product.builder';

/** Valid cart item: 2 x 10 COP. */
export function buildCartItem(
  id: string = 'item-1',
  quantity: number = 2,
  productId: string = 'product-1',
): CartItem {
  return CartItem.create(
    createCartItemId(id),
    createProductId(productId),
    'Test product',
    quantity,
    Money.from(10, Currency.COP),
    'SKU-00001',
  );
}

/**
 * Valid, event-free ACTIVE cart (reconstituted) with one item (2 x 10 COP) unless `items` is
 * overridden. The subtotal is derived from the items unless explicitly overridden.
 */
export function buildCart(overrides: Partial<CartProps> = {}): Cart {
  const items = overrides.items ?? [buildCartItem()];
  const currency = overrides.subtotal?.getCurrency() ?? Currency.COP;
  let subtotal = Money.from(0, currency);
  for (const item of items) {
    subtotal = subtotal.add(item.getSubtotal());
  }
  return Cart.reconstitute({
    id: createCartId('cart-1'),
    tenantId: createTenantId(DEFAULT_TEST_TENANT_ID),
    customerId: null,
    status: CartStatus.ACTIVE,
    expiresAt: new Date('2026-01-16T12:00:00.000Z'),
    createdAt: new Date('2026-01-15T12:00:00.000Z'),
    updatedAt: new Date('2026-01-15T12:00:00.000Z'),
    version: 0,
    subtotal,
    ...overrides,
    items,
  });
}
