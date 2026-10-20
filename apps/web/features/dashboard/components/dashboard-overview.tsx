import * as React from 'react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { DashboardOverviewReadModel } from '@canaldigital/packages/core';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import { formatMoney } from '@/lib/money';

export async function DashboardOverview({
  overview,
}: {
  overview: DashboardOverviewReadModel;
}): Promise<React.JSX.Element> {
  const [t, locale] = await Promise.all([getTranslations('AdminOverview'), getLocale()]);
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Guayaquil',
  });
  const orderHref = (id: string): string => '/dashboard/orders?order=' + id;
  const queues = [
    { label: t('paid'), description: t('paidHelp'), count: overview.awaitingPreparation },
    { label: t('processing'), description: t('processingHelp'), count: overview.processing },
    { label: t('shipped'), description: t('shippedHelp'), count: overview.shipped },
  ];
  return (
    <div className="space-y-6">
      <div className="grid items-stretch gap-6 xl:grid-cols-3">
        <Card className="gap-5 shadow-none xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">
              <h2>{t('ordersTitle')}</h2>
            </CardTitle>
            <CardDescription>{t('ordersDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="grid grid-cols-3 gap-3 sm:gap-5">
              {queues.map((queue): React.JSX.Element => (
                <div key={queue.label} className="space-y-2">
                  <dt className="min-h-10 text-sm font-medium leading-snug sm:min-h-0">
                    {queue.label}
                  </dt>
                  <dd className="text-3xl font-semibold tabular-nums tracking-tight">
                    {number.format(queue.count)}
                  </dd>
                  <dd className="sr-only sm:not-sr-only sm:text-sm sm:leading-relaxed sm:text-muted-foreground">
                    {queue.description}
                  </dd>
                </div>
              ))}
            </dl>
            {overview.awaitingPreparation === 0 && overview.processing === 0 && (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                {t('caughtUp')}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-5">
              <p className="text-sm text-muted-foreground">
                {t('pendingPayment', { count: overview.pendingPayment })}
              </p>
              <Button
                nativeButton={false}
                role="link"
                className="min-h-11 w-full sm:w-auto"
                render={<Link href="/dashboard/orders" />}
              >
                {t('manageOrders')}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-5 shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">
              <h2>{t('catalogTitle')}</h2>
            </CardTitle>
            <CardDescription>{t('catalogDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-muted-foreground">{t('activeProducts')}</dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums">
                  {number.format(overview.activeProducts)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t('activeCategories')}</dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums">
                  {number.format(overview.activeCategories)}
                </dd>
              </div>
            </dl>
            <ul className="space-y-3 border-t pt-4 text-sm">
              <li className="flex justify-between gap-4">
                <span>{t('outOfStock')}</span>
                <span className="font-medium tabular-nums">
                  {number.format(overview.outOfStock)}
                </span>
              </li>
              <li className="flex justify-between gap-4">
                <span>{t('withoutImage')}</span>
                <span className="font-medium tabular-nums">
                  {number.format(overview.withoutImage)}
                </span>
              </li>
            </ul>
            {overview.activeCategories === 0 ? (
              <Button
                nativeButton={false}
                role="link"
                variant="outline"
                className="min-h-11 w-full"
                render={<Link href="/dashboard/catalog/categories/new" />}
              >
                {t('createCategory')}
              </Button>
            ) : overview.activeProducts === 0 ? (
              <Button
                nativeButton={false}
                role="link"
                variant="outline"
                className="min-h-11 w-full"
                render={<Link href="/dashboard/catalog/products/new" />}
              >
                {t('createProduct')}
              </Button>
            ) : (
              <Link
                href="/dashboard/catalog/products"
                className="flex min-h-11 items-center justify-between gap-3 font-medium hover:underline"
              >
                {t('reviewCatalog')}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="gap-5 shadow-none">
        <CardHeader className="flex flex-wrap items-start justify-between gap-4 sm:flex-row">
          <div className="space-y-1.5">
            <CardTitle className="text-lg">
              <h2>{t('recentTitle')}</h2>
            </CardTitle>
            <CardDescription>{t('recentDescription')}</CardDescription>
          </div>
          <Link
            href="/dashboard/orders"
            className="flex min-h-11 items-center gap-2 text-sm font-medium hover:underline"
          >
            {t('allOrders')}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </CardHeader>
        <CardContent>
          {overview.recentOrders.length === 0 ? (
            <Empty className="min-h-48 rounded-lg border border-dashed">
              <EmptyHeader>
                <EmptyTitle>{t('emptyTitle')}</EmptyTitle>
                <EmptyDescription>{t('emptyDescription')}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  nativeButton={false}
                  role="link"
                  variant="outline"
                  className="min-h-11"
                  render={<Link href={'/store/' + overview.tenantSlug} />}
                >
                  {t('viewStore')}
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              <div className="hidden sm:block">
                <Table>
                  <caption className="sr-only">{t('recentTitle')}</caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">{t('order')}</TableHead>
                      <TableHead scope="col">{t('customer')}</TableHead>
                      <TableHead scope="col">{t('status')}</TableHead>
                      <TableHead scope="col" className="text-right">
                        {t('total')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.recentOrders.map((order): React.JSX.Element => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Link
                            href={orderHref(order.id)}
                            className="inline-flex min-h-11 flex-col justify-center gap-1 font-medium underline-offset-4 hover:underline"
                          >
                            {order.orderNumber}
                            <time
                              dateTime={order.createdAt}
                              className="block text-xs font-normal text-muted-foreground"
                            >
                              {date.format(new Date(order.createdAt))}
                            </time>
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-64 whitespace-normal break-words">
                          {order.customerName}
                        </TableCell>
                        <TableCell>
                          <OrderStatusBadge status={order.status} />
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(order.totalAmountCents, order.currency, locale)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="divide-y sm:hidden">
                {overview.recentOrders.map((order): React.JSX.Element => (
                  <li key={order.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <Link
                        href={orderHref(order.id)}
                        className="flex min-h-11 items-center text-sm font-semibold underline-offset-4 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <span className="text-sm font-medium tabular-nums">
                        {formatMoney(order.totalAmountCents, order.currency, locale)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="min-w-0 break-words text-sm">{order.customerName}</p>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <time
                      dateTime={order.createdAt}
                      className="block text-xs text-muted-foreground"
                    >
                      {date.format(new Date(order.createdAt))}
                    </time>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs leading-relaxed text-muted-foreground">
        <p>{t('snapshot', { at: date.format(new Date(overview.observedAt)) })}</p>
        <p>{t('timezone')}</p>
      </div>
    </div>
  );
}
