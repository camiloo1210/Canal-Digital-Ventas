import 'server-only';
import { z } from 'zod';
import type { AdminCatalogQuery, CatalogStatus } from '@canaldigital/packages/core';

export type CatalogKind = 'products' | 'categories';
export type CatalogSearchParams = Record<string, string | string[] | undefined>;
export const CATALOG_PAGE_SIZE = 25;
const categoryIdSchema = z.guid().transform((id): string => id.toLowerCase());

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
  const category = categoryIdSchema.safeParse(params.category);
  return {
    q,
    status: allowed.includes(status) ? (status as CatalogStatus) : 'all',
    page,
    limit: CATALOG_PAGE_SIZE,
    ...(kind === 'products' && category.success ? { categoryId: category.data } : {}),
  };
}

export function catalogHref(
  kind: CatalogKind,
  query: AdminCatalogQuery,
  page = query.page,
  tenantId: string | null = null,
): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.status !== 'all') params.set('status', query.status);
  if (kind === 'products' && query.categoryId) params.set('category', query.categoryId);
  if (page > 1) params.set('page', String(page));
  if (tenantId) params.set('tenant', tenantId);
  return '/dashboard/catalog/' + kind + (params.size ? '?' + params.toString() : '');
}
