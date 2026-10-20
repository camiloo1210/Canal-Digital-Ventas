import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import es from '@/messages/es.json';
import { CatalogResults } from '@/features/dashboard/components/catalog-results';
import { parseCatalogQuery } from '@/features/dashboard/queries/catalog-query';

const mocks = vi.hoisted(
  (): {
    products: ReturnType<typeof vi.fn>;
    categories: ReturnType<typeof vi.fn>;
    redirect: ReturnType<typeof vi.fn>;
  } => ({ products: vi.fn(), categories: vi.fn(), redirect: vi.fn() }),
);
vi.mock('next-intl/server', (): object => ({
  getTranslations: async (): Promise<ReturnType<typeof createTranslator>> =>
    createTranslator({ locale: 'es', messages: es.AdminCatalog }),
}));
vi.mock('next/navigation', (): object => ({ redirect: mocks.redirect }));
vi.mock('@/features/dashboard/di/dashboard.di', (): object => ({
  getAdminCatalogReadRepository: (): object => ({
    findProductsForManager: mocks.products,
    findCategoriesForManager: mocks.categories,
  }),
}));
vi.mock('@/features/dashboard/components/catalog-pagination', (): object => ({
  CatalogPagination: (): React.JSX.Element => <span />,
}));
vi.mock('@/features/dashboard/components/product-catalog-table', (): object => ({
  ProductCatalogTable: (): React.JSX.Element => <span />,
}));
vi.mock('@/features/dashboard/components/category-catalog-table', (): object => ({
  CategoryCatalogTable: (): React.JSX.Element => <span />,
}));

describe('catalog recovery and pagination', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });
  it('keeps actor and tenant server scoped and distinguishes no matches from a new catalog', async (): Promise<void> => {
    const query = parseCatalogQuery({ q: 'missing', status: 'archived' }, 'products');
    mocks.products.mockResolvedValue({ items: [], totalItems: 0, totalPages: 1, currentPage: 1 });
    const html = renderToStaticMarkup(
      await CatalogResults({ kind: 'products', query, userId: 'actor', tenantId: 'tenant' }),
    );
    expect(mocks.products).toHaveBeenCalledWith('actor', 'tenant', query);
    expect(html).toContain('No encontramos coincidencias');
    expect(html).toContain('Limpiar filtros');
    expect(html).not.toContain('Tu catálogo empieza aquí');
  });
  it('offers creation only for a genuinely unfiltered empty catalog', async (): Promise<void> => {
    mocks.categories.mockResolvedValue({ items: [], totalItems: 0, totalPages: 1, currentPage: 1 });
    const html = renderToStaticMarkup(
      await CatalogResults({
        kind: 'categories',
        query: parseCatalogQuery({}, 'categories'),
        userId: 'actor',
        tenantId: 'tenant',
      }),
    );
    expect(html).toContain('Organiza tu primer catálogo');
    expect(html).toContain('href="/dashboard/catalog/categories/new"');
  });
  it('does not show unauthorized membership as an empty catalog', async (): Promise<void> => {
    mocks.products.mockResolvedValue(null);
    const html = renderToStaticMarkup(
      await CatalogResults({
        kind: 'products',
        query: parseCatalogQuery({}, 'products'),
        userId: 'actor',
        tenantId: 'tenant',
      }),
    );
    expect(html).toContain('Catálogo no disponible');
    expect(html).not.toContain('Tu catálogo empieza aquí');
  });
  it('preserves search and page in a real retry while masking a database failure', async (): Promise<void> => {
    mocks.categories.mockRejectedValue(new Error('private database detail'));
    const spy = vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    try {
      const html = renderToStaticMarkup(
        await CatalogResults({
          kind: 'categories',
          query: parseCatalogQuery({ q: 'search', status: 'archived', page: '3' }, 'categories'),
          userId: 'actor',
          tenantId: 'tenant',
        }),
      );
      expect(html).toContain('method="get"');
      expect(html).toContain('name="q" value="search"');
      expect(html).toContain('name="status" value="archived"');
      expect(html).toContain('name="page" value="3"');
      expect(html).not.toContain('private database detail');
    } finally {
      spy.mockRestore();
    }
  });
  it('redirects out-of-range pages outside the query catch and preserves active filters', async (): Promise<void> => {
    mocks.products.mockResolvedValue({ items: [], totalItems: 51, totalPages: 3, currentPage: 9 });
    const signal = new Error('NEXT_REDIRECT');
    mocks.redirect.mockImplementation((): never => {
      throw signal;
    });
    await expect(
      CatalogResults({
        kind: 'products',
        query: parseCatalogQuery({ q: 'product', status: 'active', page: '9' }, 'products'),
        userId: 'actor',
        tenantId: 'tenant',
      }),
    ).rejects.toBe(signal);
    expect(mocks.redirect).toHaveBeenCalledWith(
      '/dashboard/catalog/products?q=product&status=active&page=3',
    );
  });
});
