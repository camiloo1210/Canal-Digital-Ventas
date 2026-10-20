import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PublicTenantDirectoryResult } from '@canaldigital/packages/core';
import { StoreDirectory } from '@/features/store-directory/components/store-directory';

vi.mock('next-intl/server', (): object => ({
  getTranslations: vi.fn().mockResolvedValue((key: string): string => key),
}));

const result: PublicTenantDirectoryResult = {
  items: [
    {
      name: 'Independent stationery',
      slug: 'stationery',
      description: null,
      logoUrl: null,
      bannerUrl: null,
    },
  ],
  currentPage: 1,
  total: 1,
  totalPages: 1,
};

describe('buyer directory discovery', (): void => {
  it('shows a real store without manufacturing cover images or truncating its identity', async (): Promise<void> => {
    const html = renderToStaticMarkup(await StoreDirectory({ result, query: '' }));
    expect(html).toContain('Independent stationery');
    expect(html).toContain('href="/store/stationery"');
    expect(html).not.toContain('aspect-[21/9]');
    expect(html).not.toContain('line-clamp-1');
    expect(html).not.toContain('recent_purchases');
  });
  it('preserves the search when paging through the complete directory', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      await StoreDirectory({
        result: { ...result, currentPage: 2, total: 60, totalPages: 3 },
        query: 'pen & paper',
      }),
    );
    expect(html).toContain('storeSearch=pen+%26+paper&amp;page=1');
    expect(html).toContain('storeSearch=pen+%26+paper&amp;page=3');
  });
  it('offers recovery from no matches and escapes the query', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      await StoreDirectory({
        result: { ...result, items: [], total: 0, totalPages: 0 },
        query: '<script>no</script>',
      }),
    );
    expect(html).toContain('emptySearchTitle');
    expect(html).toContain('href="/"');
    expect(html).not.toContain('<script>no</script>');
  });
  it('keeps a route back to the directory for an out of range URL', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      await StoreDirectory({
        result: { ...result, items: [], currentPage: 4, totalPages: 1 },
        query: '',
      }),
    );
    expect(html).toContain('outOfRange');
    expect(html).toContain('href="/"');
  });
});
