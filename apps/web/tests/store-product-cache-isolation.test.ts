import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicProductReadRepositoryPort } from '@canaldigital/packages/core';
import { getStoreProductReadRepository } from '@/features/store/di/store.di';

const mocks = vi.hoisted((): { client: ReturnType<typeof vi.fn>; cache: Map<string, string> } => ({
  client: vi.fn(),
  cache: new Map<string, string>(),
}));
vi.mock('server-only', (): object => ({}));
vi.mock('@/lib/supabase/server', (): object => ({ createClient: mocks.client }));
vi.mock('@/lib/postgres/server', (): object => ({ sql: vi.fn() }));
vi.mock('@upstash/redis', (): object => ({
  Redis: class {
    async get(key: string): Promise<string | null> {
      return mocks.cache.get(key) ?? null;
    }
    async set(key: string, value: string): Promise<void> {
      mocks.cache.set(key, value);
    }
  },
}));

const product = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Product',
  price_cents: 1000,
  currency: 'USD',
  description: '',
  category_id: null,
  sku: 'sku',
  image_url: null,
  has_variants: false,
  in_stock: true,
  availability_status: 'AVAILABLE',
  total_count: 1,
};

async function price(
  repository: PublicProductReadRepositoryPort,
  kind: string,
): Promise<number | null> {
  if (kind === 'list')
    return (await repository.searchActiveByTenantSlug('store', {})).items[0].wholesalePriceCents;
  return (
    (await repository.findDetail({ tenantSlug: 'store', productId: product.id }))
      ?.wholesalePriceCents ?? null
  );
}

beforeEach((): void => {
  vi.resetAllMocks();
  mocks.cache.clear();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test');
});

afterEach((): void => {
  vi.unstubAllEnvs();
});

describe('store product pricing follows the current session', (): void => {
  it.each(['list', 'detail'])(
    'never serves a member price to an anonymous %s reader',
    async (kind: string): Promise<void> => {
      mocks.client.mockResolvedValue({
        rpc: vi.fn().mockResolvedValue({
          data: [{ ...product, wholesale_price_cents: 500, wholesale_min_quantity: 2 }],
          error: null,
        }),
      });
      expect(await price(await getStoreProductReadRepository(), kind)).toBe(500);
      mocks.client.mockResolvedValue({
        rpc: vi.fn().mockResolvedValue({
          data: [{ ...product, wholesale_price_cents: null, wholesale_min_quantity: null }],
          error: null,
        }),
      });
      expect(await price(await getStoreProductReadRepository(), kind)).toBeNull();
    },
  );
  it.each(['list', 'detail'])(
    'does not retain wholesale access after membership revocation for %s',
    async (kind: string): Promise<void> => {
      const rpc = vi
        .fn()
        .mockResolvedValueOnce({
          data: [{ ...product, wholesale_price_cents: 500, wholesale_min_quantity: 2 }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ ...product, wholesale_price_cents: null, wholesale_min_quantity: null }],
          error: null,
        });
      mocks.client.mockResolvedValue({ rpc });
      expect(await price(await getStoreProductReadRepository(), kind)).toBe(500);
      expect(await price(await getStoreProductReadRepository(), kind)).toBeNull();
      expect(rpc).toHaveBeenCalledTimes(2);
    },
  );
});
