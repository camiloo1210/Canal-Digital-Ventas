import * as React from 'react';
import NextLink from 'next/link';
import { TenantLink as Link } from '@/features/dashboard/components/tenant-scope';
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

export interface DashboardOverviewAccess {
  orders: boolean;
  catalog: boolean;
  manageCatalog: boolean;
}

export async function DashboardOverview({
  overview,
  access,
  salesFilters,
}: {
  overview: DashboardOverviewReadModel;
  access: DashboardOverviewAccess;
  salesFilters?: React.ReactNode;
}): Promise<React.JSX.Element> {
  const [t, locale] = await Promise.all([getTranslations('AdminOverview'), getLocale()]);
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Guayaquil',
  });
  const kpis = overview.kpis;
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const shortDate = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const periodMetrics = [
    {
      key: 'periodRevenue',
      label: t('kpiPeriodRevenue'),
      value: formatMoney(kpis.revenueCents, kpis.currency, locale),
      help:
        kpis.revenueChangeBps === null
          ? t('kpiNoComparison')
          : t('kpiComparison', { percent: percent.format(kpis.revenueChangeBps / 10000) }),
      tone:
        kpis.revenueChangeBps === null
          ? 'text-muted-foreground'
          : kpis.revenueChangeBps < 0
            ? 'text-destructive'
            : 'text-success',
    },
    {
      key: 'periodOrders',
      label: t('kpiPeriodOrders'),
      value: number.format(kpis.orderCount),
      help: t('kpiOrdersHelp'),
      tone: 'text-muted-foreground',
    },
    {
      key: 'buyingCustomers',
      label: t('kpiBuyingCustomers'),
      value: number.format(kpis.buyingCustomers),
      help: t('kpiBuyingCustomersHelp'),
      tone: 'text-muted-foreground',
    },
  ];
  const queues = [
    {
      status: 'paid',
      label: t('paid'),
      description: t('paidHelp'),
      count: overview.awaitingPreparation,
    },
    {
      status: 'processing',
      label: t('processing'),
      description: t('processingHelp'),
      count: overview.processing,
    },
    {
      status: 'pending_payment',
      label: t('pendingPayment'),
      description: t('pendingPaymentHelp'),
      count: overview.pendingPayment,
    },
  ];
  const catalogAction =
    access.manageCatalog && overview.activeCategories === 0
      ? { href: '/dashboard/catalog/categories/new', label: t('createCategory') }
      : access.manageCatalog && overview.activeProducts === 0
        ? { href: '/dashboard/catalog/products/new', label: t('createProduct') }
        : { href: '/dashboard/catalog/products', label: t('reviewCatalog') };
  const orderName = (id: string, label: string): React.JSX.Element =>
    access.orders ? (
      <Link
        href={'/dashboard/orders?order=' + id}
        className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
      >
        {label}
      </Link>
    ) : (
      <span className="font-semibold">{label}</span>
    );
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="dashboard-order-queues"
          className="min-w-0 rounded-xl border border-primary/15 bg-accent/75 p-4 sm:p-5"
        >
          <h2 id="dashboard-order-queues" className="text-lg font-semibold tracking-tight">
            {t('ordersTitle')}
          </h2>
          <ul className="mt-4 divide-y divide-primary/15 border-y border-primary/15">
            {queues.map((queue): React.JSX.Element => {
              const rowClass =
                'grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-1.5 py-2.5';
              const row = (
                <>
                  <span
                    className={
                      'min-w-10 rounded-md px-2 py-1 text-center text-base font-semibold tabular-nums ' +
                      (queue.status === 'paid' && queue.count > 0
                        ? 'bg-warning/25 text-foreground'
                        : 'bg-primary/10 text-accent-foreground')
                    }
                  >
                    {number.format(queue.count)}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{queue.label}</span>
                    <span className="block text-sm text-muted-foreground">{queue.description}</span>
                  </span>
                  {access.orders && (
                    <ArrowRight aria-hidden="true" className="size-4 text-primary" />
                  )}
                </>
              );

              return (
                <li key={queue.status}>
                  {access.orders ? (
                    <Link
                      href={'/dashboard/orders?status=' + queue.status}
                      className={
                        rowClass +
                        ' transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none motion-reduce:transition-none'
                      }
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className={rowClass}>{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {overview.awaitingPreparation === 0 && overview.processing === 0 && (
            <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
              {t('caughtUp')}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 text-sm">
            <p className="py-2 text-muted-foreground">
              {t('shippedCount', { count: overview.shipped })}
            </p>
            {access.orders && (
              <Link
                href="/dashboard/orders"
                className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline-offset-4 hover:underline"
              >
                {t('allOrders')}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </div>
        </section>

        <section
          aria-labelledby="dashboard-catalog-health"
          className="min-w-0 rounded-xl border bg-card p-4 sm:p-5"
        >
          <h2 id="dashboard-catalog-health" className="text-lg font-semibold tracking-tight">
            {t('catalogTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('catalogDescription')}</p>
          <dl className="mt-4 divide-y divide-border border-y text-sm">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt>{t('outOfStock')}</dt>
              <dd className="font-semibold tabular-nums">{number.format(overview.outOfStock)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt>{t('withoutImage')}</dt>
              <dd className="font-semibold tabular-nums">{number.format(overview.withoutImage)}</dd>
            </div>
          </dl>
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <dt>{t('activeProducts')}</dt>
              <dd className="font-semibold text-foreground tabular-nums">
                {number.format(overview.activeProducts)}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <dt>{t('activeCategories')}</dt>
              <dd className="font-semibold text-foreground tabular-nums">
                {number.format(overview.activeCategories)}
              </dd>
            </div>
          </dl>
          {access.catalog && (
            <Link
              href={catalogAction.href}
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              {catalogAction.label}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          )}
        </section>
      </div>

      <section aria-labelledby="dashboard-sales-title" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="dashboard-sales-title" className="text-lg font-semibold tracking-tight">
            {t('kpiTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('kpiPeriod', {
              from: shortDate.format(new Date(kpis.periodStart)),
              to: shortDate.format(new Date(kpis.periodEnd)),
            })}
          </p>
        </div>
        {kpis.excludedCurrencyOrders > 0 && (
          <p role="status" className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
            {t('currencyScope', { currency: kpis.currency, count: kpis.excludedCurrencyOrders })}
          </p>
        )}
        <div className="rounded-xl border bg-card">
          <dl className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {periodMetrics.map((metric): React.JSX.Element => (
              <div key={metric.key} className="min-w-0 space-y-1 px-4 py-3 sm:p-4">
                <dt className="text-sm text-muted-foreground">{metric.label}</dt>
                <dd className="text-2xl font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere]">
                  {metric.value}
                </dd>
                <dd className={'text-sm ' + metric.tone}>{metric.help}</dd>
              </div>
            ))}
          </dl>
          <dl
            aria-label={t('lifetimeTitle')}
            className="flex flex-wrap gap-x-8 gap-y-3 border-t px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-baseline gap-x-2">
              <dt className="text-muted-foreground">{t('kpiLifetimeRevenue')}</dt>
              <dd className="font-semibold tabular-nums">
                {formatMoney(kpis.lifetimeRevenueCents, kpis.currency, locale)}
              </dd>
              <dd className="basis-full text-xs text-muted-foreground">
                {t('kpiLifetimeHelp', { count: kpis.lifetimeOrderCount })}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <dt className="text-muted-foreground">{t('kpiCustomers')}</dt>
              <dd className="font-semibold tabular-nums">{number.format(kpis.totalCustomers)}</dd>
            </div>
          </dl>
        </div>
        {salesFilters}
      </section>
      <Card className="gap-5">
        <CardHeader className="flex flex-wrap items-start justify-between gap-4 sm:flex-row">
          <div className="space-y-1.5">
            <CardTitle className="text-base font-semibold tracking-tight">
              <h2>{t('recentTitle')}</h2>
            </CardTitle>
            <CardDescription>{t('recentDescription')}</CardDescription>
          </div>
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
                  render={<NextLink href={'/store/' + overview.tenantSlug} />}
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
                          {orderName(order.id, order.orderNumber)}
                          <time
                            dateTime={order.createdAt}
                            className="block text-xs text-muted-foreground"
                          >
                            {date.format(new Date(order.createdAt))}
                          </time>
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
                      {orderName(order.id, order.orderNumber)}
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
