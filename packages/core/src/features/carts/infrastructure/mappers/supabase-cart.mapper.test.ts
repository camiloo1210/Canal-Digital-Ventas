import { describe, expect, it } from 'vitest';
import { SupabaseCartMapper } from '@/carts/infrastructure/mappers/supabase-cart.mapper';
import { DbCartRow } from '@/carts/infrastructure/types/supabase-cart.types';
import { Currency } from '@/shared/domain/enums/currency.enum';

function row(currency: string | null | undefined, amount: number): DbCartRow {
  const now = new Date().toISOString();
  return {
    id: 'cart',
    tenant_id: 'tenant',
    customer_id: null,
    status: 'active',
    subtotal_cents: amount,
    currency,
    expires_at: new Date(Date.now() + 60000).toISOString(),
    created_at: now,
    updated_at: now,
    version: 0,
    cart_items: [
      {
        id: 'item',
        cart_id: 'cart',
        product_id: 'product',
        variant_id: null,
        product_name: 'Item',
        sku: 'SKU',
        quantity: 1,
        unit_price_cents: amount,
        subtotal_cents: amount,
        created_at: now,
        updated_at: now,
      },
    ],
  };
}

describe('SupabaseCartMapper currency', (): void => {
  it.each([Currency.CLP, Currency.COP, Currency.USD])(
    'round-trips %s without reinterpreting amounts',
    (currency: Currency): void => {
      const cart = SupabaseCartMapper.toDomain(row(currency, 5000));
      expect(cart.getSubtotal().getCurrency()).toBe(currency);
      expect(cart.getSubtotal().getValue()).toBe(5000);
      const { cartRow } = SupabaseCartMapper.toPersistence(cart);
      expect(cartRow.currency).toBe(currency);
      expect(cartRow.subtotal_cents).toBe(5000);
    },
  );
  it('throws instead of defaulting when the row has no or an unknown currency', (): void => {
    expect((): unknown => SupabaseCartMapper.toDomain(row(null, 10))).toThrow();
    expect((): unknown => SupabaseCartMapper.toDomain(row(undefined, 10))).toThrow();
    expect((): unknown => SupabaseCartMapper.toDomain(row('XXX', 10))).toThrow();
  });
});
