import { describe, expect, it } from 'vitest';
import { SupabaseProductMapper } from '@/products/infrastructure/mappers/supabase-product.mapper';
import { DbProductRow } from '@/products/infrastructure/types/supabase-product.types';
import { Currency } from '@/shared/domain/enums/currency.enum';
const row: DbProductRow = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  tenant_id: '750e8400-e29b-41d4-a716-446655440000',
  category_id: '650e8400-e29b-41d4-a716-446655440000',
  name: 'Cafe',
  sku: 'CAFE01',
  price_cents: 10000,
  cost_cents: 1000,
  wholesale_price_cents: 9000,
  wholesale_min_quantity: 2,
  stock: 4,
  description: '',
  status: 'active',
  expiration_date: null,
  season_ids: [],
  image_path: null,
  image_url: null,
  gallery_urls: [],
  has_variants: false,
  is_vat_exempt: false,
  version: 0,
  updated_at: '2026-01-01T00:00:00Z',
};
describe('product currency mapping', (): void => {
  it('reconstitutes all amounts in the tenant currency without conversion', (): void => {
    const product = SupabaseProductMapper.toDomain(row, Currency.COP);
    expect(product.getPrice().getCurrency()).toBe('COP');
    expect(product.getCost().getCurrency()).toBe('COP');
    expect(product.getWholesalePrice().getCurrency()).toBe('COP');
    expect(SupabaseProductMapper.toPersistence(product).price_cents).toBe(10000);
    const restored = SupabaseProductMapper.toDomain(
      SupabaseProductMapper.toPersistence(product),
      Currency.COP,
    );
    expect(restored.getPrice().getCurrency()).toBe('COP');
    expect(restored.getWholesalePrice().getValue()).toBe(9000);
  });

  it('round-trips the four package columns', (): void => {
    const product = SupabaseProductMapper.toDomain(
      { ...row, weight_grams: 500, length_mm: 300, width_mm: 200, height_mm: 100 },
      Currency.COP,
    );
    expect(product.getPackageData()?.weightGrams).toBe(500);
    const persisted = SupabaseProductMapper.toPersistence(product);
    expect(persisted.weight_grams).toBe(500);
    expect(persisted.length_mm).toBe(300);
    expect(persisted.width_mm).toBe(200);
    expect(persisted.height_mm).toBe(100);
  });

  it('maps absent package columns to null', (): void => {
    const product = SupabaseProductMapper.toDomain(row, Currency.COP);
    expect(product.getPackageData()).toBeNull();
    const persisted = SupabaseProductMapper.toPersistence(product);
    expect(persisted.weight_grams).toBeNull();
    expect(persisted.height_mm).toBeNull();
  });
});
