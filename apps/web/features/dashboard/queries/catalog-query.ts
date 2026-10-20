import type { AdminCatalogQuery, CatalogStatus } from '@canaldigital/packages/core';

export type CatalogKind = 'products' | 'categories';
export type CatalogSearchParams = Record<string, string | string[] | undefined>;
export const CATALOG_PAGE_SIZE = 25;

export function parseCatalogQuery(
  params: CatalogSearchParams,
  kind: CatalogKind,
): AdminCatalogQuery {
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 200) : '';
  const status = typeof params.status === 'string' ? params.status : 'all';
  const allowed: readonly string[] =
    kind === 'products'
      ? ['active', 'inactive', 'out_of_stock', 'archived']
      : ['active', 'inactive', 'archived'];
  const page =
    typeof params.page === 'string' && /^[1-9]\d{0,5}$/.test(params.page) ? Number(params.page) : 1;
  return {
    q,
    status: allowed.includes(status) ? (status as CatalogStatus) : 'all',
    page,
    limit: CATALOG_PAGE_SIZE,
  };
}

export function catalogHref(
  kind: CatalogKind,
  query: AdminCatalogQuery,
  page = query.page,
): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.status !== 'all') params.set('status', query.status);
  if (page > 1) params.set('page', String(page));
  return '/dashboard/catalog/' + kind + (params.size ? '?' + params.toString() : '');
}
