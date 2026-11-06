import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabasePublicProductReadRepository } from '@/products/infrastructure/repositories/supabase-public-product-read.repository';

const row = {
  id: 'p1',
  name: 'Product',
  price_cents: 12345,
  currency: 'COP',
  description: null,
  category_id: null,
  sku: 'SKU',
  image_url: null,
  has_variants: false,
  in_stock: true,
  availability_status: 'AVAILABLE',
  wholesale_price_cents: 10001,
  wholesale_min_quantity: 3,
  total_count: 1,
};

describe('public catalog currency projection', (): void => {
  it('uses versioned public catalog RPCs and preserves minor units and tenant currency', async (): Promise<void> => {
    const rpc = vi.fn().mockResolvedValue({ data: [row], error: null });
    const repository = new SupabasePublicProductReadRepository({
      rpc,
    } as unknown as SupabaseClient);
    const listing = await repository.searchActiveByTenantSlug('shop', {});
    const detail = await repository.findDetail({ tenantSlug: 'shop', productId: 'p1' });
    expect(rpc.mock.calls[0][0]).toBe('get_public_products_by_slug_v2');
    expect(rpc.mock.calls[1][0]).toBe('get_public_product_by_id_v2');
    for (const product of [listing.items[0], detail]) {
      expect(product).toMatchObject({
        priceCents: 12345,
        currency: 'COP',
        wholesalePriceCents: 10001,
        wholesaleMinQuantity: 3,
      });
    }
  });
});
