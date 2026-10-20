export interface SellerOrdersQuery {
  q: string;
  status: string;
  page: number;
  order: string | null;
}
export type SellerOrdersSearchParams = Record<string, string | string[] | undefined>;
export const sellerOrderStatuses = [
  'all',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'pending_payment',
  'confirmed',
  'cancelled',
  'refunded',
] as const;

export function parseSellerOrdersQuery(params: SellerOrdersSearchParams): SellerOrdersQuery {
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 200) : '';
  const status =
    typeof params.status === 'string' &&
    sellerOrderStatuses.some((value): boolean => value === params.status)
      ? params.status
      : 'all';
  const page =
    typeof params.page === 'string' && /^[1-9]\d{0,4}$/.test(params.page) ? Number(params.page) : 1;
  const order =
    typeof params.order === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(params.order)
      ? params.order
      : null;
  return { q, status, page, order };
}

export function sellerOrdersHref(
  query: SellerOrdersQuery,
  changes: Partial<SellerOrdersQuery> = {},
): string {
  const value = { ...query, ...changes };
  const params = new URLSearchParams();
  if (value.q) params.set('q', value.q);
  if (value.status !== 'all') params.set('status', value.status);
  if (value.page > 1) params.set('page', String(value.page));
  if (value.order) params.set('order', value.order);
  return '/dashboard/orders' + (params.size ? '?' + params.toString() : '');
}
