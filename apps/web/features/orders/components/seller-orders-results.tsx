import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronLeft, ChevronRight, PackageSearch } from 'lucide-react';
import type { SellerOrderPage } from '@canaldigital/packages/core';
import { ordersDi } from '@/features/orders/di/orders.di';
import {
  sellerOrdersHref,
  type SellerOrdersQuery,
} from '@/features/orders/queries/seller-orders-query';
import { SellerOrdersTable } from '@/features/orders/components/seller-orders-table';
import { SellerOrderDetailsDialog } from '@/features/orders/components/seller-order-details-dialog';
import { SellerOrderDetails } from '@/features/orders/components/seller-order-details';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';

export async function SellerOrdersResults({
  userId,
  tenantId,
  query,
}: {
  userId: string;
  tenantId: string;
  query: SellerOrdersQuery;
}): Promise<React.JSX.Element> {
  const t = await getTranslations('AdminOrders');
  let result: SellerOrderPage | null = null;
  let detail: SellerOrderPage | null = null;
  try {
    const repository = ordersDi.resolveSellerOrderReadRepository();
    [result, detail] = await Promise.all([
      repository.findBySeller(userId, tenantId, query.page, {
        query: query.q,
        status: query.status,
      }),
      query.order
        ? repository.findBySeller(userId, tenantId, 1, { orderId: query.order })
        : Promise.resolve(null),
    ]);
  } catch (error: unknown) {
    console.error('[SellerOrders]', error);
  }
  if (!result)
    return (
      <Alert role="alert">
        <AlertTitle>{t('errorTitle')}</AlertTitle>
        <AlertDescription>
          <p>{t('errorDescription')}</p>
          <form action="/dashboard/orders" method="get">
            <input type="hidden" name="q" value={query.q} />
            <input type="hidden" name="status" value={query.status} />
            <input type="hidden" name="page" value={query.page} />
            {query.order && <input type="hidden" name="order" value={query.order} />}
            <Button type="submit" variant="outline" className="mt-3 min-h-11">
              {t('retry')}
            </Button>
          </form>
        </AlertDescription>
      </Alert>
    );
  if (!result.authorized)
    return (
      <Alert role="alert">
        <AlertTitle>{t('accessTitle')}</AlertTitle>
        <AlertDescription>{t('accessDescription')}</AlertDescription>
      </Alert>
    );
  if (query.page > result.totalPages)
    redirect(sellerOrdersHref(query, { page: result.totalPages }));
  const filtered = Boolean(query.q || query.status !== 'all');
  const selected = detail?.items[0];
  return (
    <>
      {query.order && !selected && (
        <Alert role="alert">
          <AlertTitle>{t('orderUnavailable')}</AlertTitle>
          <AlertDescription>
            <Link
              href={sellerOrdersHref(query, { order: null })}
              className="inline-flex min-h-11 items-center underline"
            >
              {t('close')}
            </Link>
          </AlertDescription>
        </Alert>
      )}
      <section aria-label={t('title')} className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
          <p className="text-sm font-medium">{t('count', { count: result.totalItems })}</p>
          <p className="text-xs text-muted-foreground">{t('sort')}</p>
        </div>
        {result.items.length === 0 ? (
          <Empty className="min-h-72">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageSearch aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t(filtered ? 'noResults' : 'emptyTitle')}</EmptyTitle>
              <EmptyDescription>
                {t(filtered ? 'noResultsDescription' : 'emptyDescription')}
              </EmptyDescription>
            </EmptyHeader>
            {filtered && (
              <EmptyContent>
                <Button
                  nativeButton={false}
                  role="link"
                  variant="outline"
                  className="min-h-11"
                  render={<Link href="/dashboard/orders" />}
                >
                  {t('clear')}
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <SellerOrdersTable orders={result.items} query={query} />
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t p-4 sm:px-5">
          <p role="status" className="text-sm text-muted-foreground">
            {t('range', {
              from: result.totalItems ? (query.page - 1) * 25 + 1 : 0,
              to: Math.min(query.page * 25, result.totalItems),
              total: result.totalItems,
            })}
          </p>
          <Pagination aria-label={t('pagination')} className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                {query.page > 1 ? (
                  <PaginationLink
                    href={sellerOrdersHref(query, { page: query.page - 1, order: null })}
                    aria-label={t('previous')}
                  >
                    <ChevronLeft aria-hidden="true" className="size-4" />
                  </PaginationLink>
                ) : (
                  <span
                    aria-disabled="true"
                    aria-label={t('previous')}
                    className="inline-flex size-11 items-center justify-center text-muted-foreground/40"
                  >
                    <ChevronLeft aria-hidden="true" className="size-4" />
                  </span>
                )}
              </PaginationItem>
              <PaginationItem>
                <span className="px-2 text-sm tabular-nums">
                  {t('page', { current: query.page, total: result.totalPages })}
                </span>
              </PaginationItem>
              <PaginationItem>
                {result.hasNext ? (
                  <PaginationLink
                    href={sellerOrdersHref(query, { page: query.page + 1, order: null })}
                    aria-label={t('next')}
                  >
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </PaginationLink>
                ) : (
                  <span
                    aria-disabled="true"
                    aria-label={t('next')}
                    className="inline-flex size-11 items-center justify-center text-muted-foreground/40"
                  >
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </span>
                )}
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </section>
      <p className="text-xs text-muted-foreground">{t('timezone')}</p>
      {selected && (
        <SellerOrderDetailsDialog
          key={selected.id}
          orderId={selected.id}
          title={selected.orderNumber}
          closeHref={sellerOrdersHref(query, { order: null })}
        >
          <SellerOrderDetails order={selected} />
        </SellerOrderDetailsDialog>
      )}
    </>
  );
}
