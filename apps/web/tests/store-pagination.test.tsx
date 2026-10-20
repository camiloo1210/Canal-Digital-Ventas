import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StorePagination } from '@/features/store/components/store-pagination';

vi.mock('next-intl/server', (): object => ({
  getTranslations: vi.fn().mockResolvedValue((key: string): string => key),
}));
describe('store pagination', (): void => {
  it('preserves filters in previous and next links', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      await StorePagination({
        tenantSlug: 'shop',
        currentPage: 2,
        totalPages: 3,
        q: 'a & b',
        categorySlug: 'office',
      }),
    );
    expect(html).toContain('q=a+%26+b&amp;category=office&amp;page=1');
    expect(html).toContain('q=a+%26+b&amp;category=office&amp;page=3');
  });
  it('does not expose a previous link on the first page', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      await StorePagination({ tenantSlug: 'shop', currentPage: 1, totalPages: 3 }),
    );
    expect(html).not.toContain('rel="prev"');
    expect(html).toContain('rel="next"');
    expect(html).toContain('aria-disabled="true"');
  });
  it('allows going back when a requested page exceeds the result range', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      await StorePagination({ tenantSlug: 'shop', currentPage: 4, totalPages: 3 }),
    );
    expect(html).toContain('page=3');
    expect(html).not.toContain('rel="next"');
  });
});
