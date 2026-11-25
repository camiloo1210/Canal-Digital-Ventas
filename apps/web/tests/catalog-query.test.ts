import { describe, expect, it } from 'vitest';
import { catalogHref, parseCatalogQuery } from '@/features/dashboard/queries/catalog-query';

describe('catalog URL state', (): void => {
  it('round-trips an exact product category alongside text, status, tenant and pagination', (): void => {
    const categoryId = '550e8400-e29b-41d4-a716-446655440000';
    const query = parseCatalogQuery(
      { category: categoryId, q: 'lápiz', status: 'active' },
      'products',
    );
    expect(query.categoryId).toBe(categoryId);
    const url = new URL(catalogHref('products', query, 2, 'tenant'), 'http://localhost');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'lápiz',
      status: 'active',
      category: categoryId,
      page: '2',
      tenant: 'tenant',
    });
    expect(parseCatalogQuery({ category: [categoryId] }, 'products').categoryId).toBeUndefined();
    expect(parseCatalogQuery({ category: 'invalid' }, 'products').categoryId).toBeUndefined();
    expect(parseCatalogQuery({ category: categoryId }, 'categories').categoryId).toBeUndefined();
  });
  it.each(['0', '-1', '1.5', 'NaN', 'Infinity', '1e3', '999999999999'])(
    'normalizes invalid page %s',
    (page): void => {
      expect(parseCatalogQuery({ page }, 'products').page).toBe(1);
    },
  );
  it('keeps valid filters and the third page, making item 51 accessible at 25 per page', (): void => {
    const query = parseCatalogQuery(
      { q: '  Product 51 ', status: 'archived', page: '3' },
      'products',
    );
    expect(query).toEqual({ q: 'Product 51', status: 'archived', page: 3, limit: 25 });
    expect(catalogHref('products', query, 4)).toBe(
      '/dashboard/catalog/products?q=Product+51&status=archived&page=4',
    );
    expect(catalogHref('products', query, 1)).toBe(
      '/dashboard/catalog/products?q=Product+51&status=archived',
    );
  });
  it('does not accept repeated scalar parameters or unsupported category states', (): void => {
    expect(
      parseCatalogQuery({ q: ['a', 'b'], status: 'out_of_stock', page: ['2', '3'] }, 'categories'),
    ).toEqual({ q: '', status: 'all', page: 1, limit: 25 });
  });
  it('encodes reserved query characters without adding URL parameters', (): void => {
    const query = parseCatalogQuery({ q: 'a&status=archived#?' }, 'products');
    const url = new URL(catalogHref('products', query), 'http://localhost');
    expect(url.searchParams.get('q')).toBe('a&status=archived#?');
    expect(url.searchParams.has('status')).toBe(false);
    expect(url.hash).toBe('');
  });
  it('limits request text and preserves the default clean route', (): void => {
    expect(parseCatalogQuery({ q: 'x'.repeat(300) }, 'products').q).toHaveLength(200);
    expect(catalogHref('categories', parseCatalogQuery({}, 'categories'))).toBe(
      '/dashboard/catalog/categories',
    );
  });
});
