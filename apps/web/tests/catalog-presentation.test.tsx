import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import es from '@/messages/es.json';
import { CatalogPagination } from '@/features/dashboard/components/catalog-pagination';
import { ProductCatalogTable } from '@/features/dashboard/components/product-catalog-table';
import { CategoryCatalogTable } from '@/features/dashboard/components/category-catalog-table';
import { parseCatalogQuery } from '@/features/dashboard/queries/catalog-query';

vi.mock('next-intl/server', (): object => ({
  getLocale: async (): Promise<string> => 'es',
  getTranslations: async (): Promise<ReturnType<typeof createTranslator>> =>
    createTranslator({ locale: 'es', messages: es.AdminCatalog }),
}));
vi.mock('@/features/products/components/product-card-actions', (): object => ({
  ProductCardActions: (): React.JSX.Element => <button type="button">Actions</button>,
}));
vi.mock('@/features/categories/components/category-card-actions', (): object => ({
  CategoryCardActions: (): React.JSX.Element => <button type="button">Actions</button>,
}));

describe('catalog presentation', (): void => {
  it('makes record 51 reachable and preserves filters in the next page URL', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      await CatalogPagination({
        kind: 'products',
        query: parseCatalogQuery({ q: 'A&B', status: 'active', page: '2' }, 'products'),
        totalItems: 51,
        totalPages: 3,
      }),
    );
    expect(html).toContain('26–50 de 51 resultados');
    expect(html).toContain('q=A%26B&amp;status=active&amp;page=3');
    expect(html).toContain('Página siguiente');
    expect(html).not.toContain('aria-current="page"');
  });
  it('shows complete names and actual currency, SKU, stock and category without truncation', async (): Promise<void> => {
    const name = 'Un producto con un nombre completo considerablemente más largo que una tarjeta';
    const html = renderToStaticMarkup(
      await ProductCatalogTable({
        items: [
          {
            id: 'product',
            name,
            sku: 'SKU-51',
            categoryName: 'Categoría',
            priceCents: 12345,
            currency: 'EUR',
            stock: 51,
            status: 'out_of_stock',
            imageUrl: null,
          },
        ],
      }),
    );
    expect(html).toContain(name);
    expect(html).toContain('SKU-51');
    expect(html).toContain('123,45');
    expect(html).toContain('€');
    expect(html).toContain('51 unidades');
    expect(html).toContain('Agotado');
    expect(html).not.toContain('line-clamp');
  });
  it('localizes missing descriptions and reports product associations', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      await CategoryCatalogTable({
        items: [
          {
            id: 'category',
            name: 'Categoría completa',
            description: null,
            status: 'archived',
            productCount: 51,
          },
        ],
      }),
    );
    expect(html).toContain('Sin descripción');
    expect(html).toContain('Archivado');
    expect(html).toContain('51 productos asociados');
    expect(html).toContain('/dashboard/catalog/categories/category/edit');
  });
});
