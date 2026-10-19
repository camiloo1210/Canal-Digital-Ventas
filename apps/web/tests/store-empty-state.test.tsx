import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StoreProductGrid } from '@/features/store/components/store-product-grid';

vi.mock('next-intl/server', (): object => ({
  getLocale: vi.fn().mockResolvedValue('es'),
  getTranslations: vi
    .fn()
    .mockResolvedValue(
      (key: string, values?: { query?: string }): string => `${key}${values?.query ?? ''}`,
    ),
}));

describe('store discovery recovery', (): void => {
  it('distinguishes an unpublished catalog from filters with no matches', async (): Promise<void> => {
    const html = renderToStaticMarkup(await StoreProductGrid({ products: [], tenantSlug: 'shop' }));
    expect(html).toContain('empty.catalogTitle');
    expect(html).not.toContain('empty.clearFilters');
  });
  it('escapes the query and clears all filters with a real catalog link', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      await StoreProductGrid({
        products: [],
        tenantSlug: 'shop',
        q: '<script>alert(1)</script>',
        categorySlug: 'office',
      }),
    );
    expect(html).toContain('empty.filteredTitle');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('href="/store/shop"');
    expect(html).toContain('empty.clearFilters');
  });
  it('offers a first page link for a stale pagination URL', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      await StoreProductGrid({ products: [], tenantSlug: 'shop', outOfRange: true }),
    );
    expect(html).toContain('pagination.outOfRange');
    expect(html).toContain('empty.firstPage');
  });
});
