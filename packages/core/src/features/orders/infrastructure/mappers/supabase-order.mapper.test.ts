import { describe, expect, it } from 'vitest';
import { SupabaseOrderMapper } from '@/orders/infrastructure/mappers/supabase-order.mapper';
import { DbOrderRow } from '@/orders/infrastructure/types/supabase-order.types';
const row: DbOrderRow = {
  id: 'order-1',
  order_number: 'ORD-1',
  customer_id: 'customer-1',
  tenant_id: 'tenant-1',
  currency: 'COP',
  status: 'confirmed',
  subtotal_cents: 20000,
  tax_amount_cents: 0,
  discount_amount_cents: 0,
  shipping_cost_cents: 0,
  total_amount_cents: 20000,
  shipping_address: {
    street: 'Calle 1',
    city: 'Bogota',
    state: 'Bogota',
    country: 'CO',
    zipCode: '110111',
  },
  payment_gateway_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  version: 0,
  order_items: [
    {
      id: 'item-1',
      order_id: 'order-1',
      product_id: 'product-1',
      variant_id: null,
      product_name: 'Cafe',
      sku: 'CAFE',
      unit_price_cents: 10000,
      quantity: 2,
      subtotal_cents: 20000,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ],
};
describe('order currency persistence', (): void => {
  it('round trips order and line money using the persisted currency snapshot', (): void => {
    const order = SupabaseOrderMapper.toDomain(row);
    expect(order.getTotalAmount().getCurrency()).toBe('COP');
    expect(order.getItems()[0].getUnitPrice().getCurrency()).toBe('COP');
    const persisted = SupabaseOrderMapper.toPersistence(order);
    expect(persisted.orderRow.currency).toBe('COP');
    expect(persisted.orderRow.total_amount_cents).toBe(20000);
    expect(
      SupabaseOrderMapper.toDomain({ ...persisted.orderRow, order_items: persisted.orderItemsRows })
        .getSubtotal()
        .getCurrency(),
    ).toBe('COP');
  });
  it('rejects absent or unsupported stored currencies instead of assuming USD', (): void => {
    expect((): void => {
      SupabaseOrderMapper.toDomain({ ...row, currency: '' });
    }).toThrow();
  });
});
