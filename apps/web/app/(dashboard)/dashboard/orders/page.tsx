import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import type { SellerOrderReadModel } from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import { ordersDi } from '@/features/orders/di/orders.di';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import { SellerOrderStatusForm } from '@/features/orders/components/seller-order-status-form';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function SellerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<React.JSX.Element> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect('/login');
  const tenantId = await getActiveTenantQuery(user.id);
  if (!tenantId) redirect('/onboarding');
  const query = await searchParams;
  const result = await ordersDi
    .resolveSellerOrderReadRepository()
    .findBySeller(user.id, tenantId, Number(query.page ?? 1));
  const t = await getTranslations('SellerOrders');
  const locale = await getLocale();
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader breadcrumbs={[{ label: t('title'), href: null }]} />
      <main className="flex flex-col gap-6 p-4 lg:p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('description')}</p>
        </div>
        {result.items.length === 0 ? (
          <p className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            {t('empty')}
          </p>
        ) : (
          result.items.map((order: SellerOrderReadModel): React.JSX.Element => (
            <Card key={order.id}>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle>{order.orderNumber}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(order.createdAt))}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <dl className="grid gap-3 text-sm md:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">{t('customer')}</dt>
                    <dd>{order.customerName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t('address')}</dt>
                    <dd>{order.shippingAddress}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t('total')}</dt>
                    <dd className="font-semibold">
                      {new Intl.NumberFormat(locale, {
                        style: 'currency',
                        currency: order.currency,
                      }).format(order.totalAmountCents / 100)}
                    </dd>
                  </div>
                </dl>
                <ul aria-label={t('products')} className="divide-y rounded-lg border px-3">
                  {order.items.map(
                    (item: SellerOrderReadModel['items'][number]): React.JSX.Element => (
                      <li key={item.id} className="flex justify-between gap-4 py-2 text-sm">
                        <span>{item.productName}</span>
                        <span>{t('quantity', { quantity: item.quantity })}</span>
                      </li>
                    ),
                  )}
                </ul>
                {order.nextStatus ? (
                  <SellerOrderStatusForm
                    key={`${order.id}:${order.version}`}
                    orderId={order.id}
                    version={order.version}
                    nextStatus={order.nextStatus}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{t('noTransition')}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
        <nav aria-label={t('pagination')} className="flex justify-between gap-4">
          {result.page > 1 ? (
            <Link href={`/dashboard/orders?page=${result.page - 1}`} className="underline">
              {t('previous')}
            </Link>
          ) : (
            <span />
          )}
          {result.hasNext && (
            <Link href={`/dashboard/orders?page=${result.page + 1}`} className="underline">
              {t('next')}
            </Link>
          )}
        </nav>
      </main>
    </div>
  );
}
