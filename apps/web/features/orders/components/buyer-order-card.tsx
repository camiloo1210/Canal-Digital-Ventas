'use client';

import * as React from 'react';
import { formatMoney } from '@/lib/money';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import type { BuyerOrderReadModel } from '@canaldigital/packages/core';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import { CancelOrderDialog } from '@/features/orders/components/cancel-order-dialog';
import { PayOrderButton } from '@/features/payments/components/pay-order-button';
import { Store, Calendar, Package, PackageCheck, AlertCircle, Truck } from 'lucide-react';

interface BuyerOrderCardProps {
  order: BuyerOrderReadModel;
  paymentsEnabled?: boolean;
  showDetailsLink?: boolean;
}

export function BuyerOrderCard({
  order,
  paymentsEnabled = false,
  showDetailsLink = true,
}: BuyerOrderCardProps): React.JSX.Element {
  const t = useTranslations('Orders.card');
  const locale = useLocale();

  const formattedDate = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Guayaquil',
  }).format(new Date(order.createdAt));

  const normalizedStatus = order.status.toLowerCase();
  const isPaid = normalizedStatus === 'paid';
  const isDelivered = normalizedStatus === 'delivered';
  const isInTransitOrDelivered = normalizedStatus === 'shipped' || normalizedStatus === 'delivered';

  return (
    <Card
      id={`order-${order.id}`}
      className="scroll-mt-6 shadow-sm border-border hover:shadow-md transition-shadow duration-200"
    >
      <CardHeader className="border-b border-border bg-muted/20 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">
                {order.orderNumber}
              </CardTitle>
              <OrderStatusBadge status={order.status} />
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" />
                <Link
                  href={`/store/${order.tenantSlug}`}
                  className="font-medium text-foreground hover:underline transition-all"
                >
                  {order.tenantName}
                </Link>
              </div>

              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>

          <div className="text-right sm:self-center">
            <span className="text-xs text-muted-foreground block">{t('total')}</span>
            <span className="text-lg font-bold text-foreground">
              {formatMoney(order.totalAmountCents, order.currency, locale)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {order.nextStep && (
          <p className="rounded-lg bg-muted/30 p-4 text-sm">
            <span className="font-semibold">{t('nextStepTitle')} </span>
            {t(`nextStep.${order.nextStep}`)}
          </p>
        )}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Package className="w-3.5 h-3.5" />
            <span>{t('items')}</span>
          </div>

          <ul className="divide-y divide-border/60 rounded-lg border border-border/50 bg-background/50 px-3">
            {order.items.map((item): React.JSX.Element => (
              <li key={item.id} className="py-2.5 flex items-center justify-between text-sm gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-foreground truncate">{item.productName}</span>
                  <span className="text-xs text-muted-foreground shrink-0">× {item.quantity}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-medium text-foreground">
                    {formatMoney(item.subtotalCents, order.currency, locale)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs text-muted-foreground border-t border-border/40">
          <div>
            <span>{t('subtotal')}: </span>
            <span className="font-medium text-foreground">
              {formatMoney(order.subtotalCents, order.currency, locale)}
            </span>
          </div>
          <div>
            <span>{t('tax')}: </span>
            <span className="font-medium text-foreground">
              {formatMoney(order.taxAmountCents, order.currency, locale)}
            </span>
          </div>
          <div>
            <span>{t('shipping')}: </span>
            <span className="font-medium text-foreground">
              {formatMoney(order.shippingCostCents, order.currency, locale)}
            </span>
          </div>
          <div className="text-right sm:text-left">
            <span>{t('total')}: </span>
            <span className="font-bold text-foreground">
              {formatMoney(order.totalAmountCents, order.currency, locale)}
            </span>
          </div>
        </div>
        {!showDetailsLink && (
          <p className="text-sm text-muted-foreground">{t('helpUnavailable')}</p>
        )}
        {!showDetailsLink && (
          <p className="rounded-lg border p-4 text-sm">
            <span className="text-muted-foreground">{t('paymentTitle')}: </span>
            <span className="font-medium">
              {t(`paymentStatus.${order.paymentStatus ?? 'unavailable'}`)}
            </span>
          </p>
        )}
        {!showDetailsLink && order.shippingAddress && (
          <dl className="rounded-lg border p-4 text-sm">
            <dt className="text-muted-foreground">{t('deliveryAddress')}</dt>
            <dd className="mt-1 break-words font-medium">{order.shippingAddress}</dd>
          </dl>
        )}
        {!order.shipment && (
          <p className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
            {t(
              order.shipmentAvailability === 'unavailable'
                ? 'shipmentUnavailable'
                : 'shipmentMissing',
            )}
          </p>
        )}
        {order.shipment && (
          <section
            className="space-y-2 rounded-lg border bg-muted/20 p-4"
            aria-label={t('shipmentTitle')}
          >
            <h3 className="text-sm font-semibold">{t('shipmentTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('shipmentManual')}</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {order.shipment.carrier && (
                <div>
                  <dt className="text-muted-foreground">{t('shipmentCarrier')}</dt>
                  <dd className="break-words font-medium">{order.shipment.carrier}</dd>
                </div>
              )}
              {order.shipment.trackingNumber && (
                <div>
                  <dt className="text-muted-foreground">{t('shipmentTracking')}</dt>
                  <dd className="break-all font-medium">{order.shipment.trackingNumber}</dd>
                </div>
              )}
            </dl>
          </section>
        )}
        <details className="border-t border-border pt-3">
          <summary className="cursor-pointer rounded-sm py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            {t('activityTitle')}
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">{t('activityDisclaimer')}</p>
          {order.history === null ? (
            <p className="mt-3 text-sm text-muted-foreground">{t('activityUnavailable')}</p>
          ) : order.history.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t('activityEmpty')}</p>
          ) : (
            <ol className="mt-3 space-y-3 border-l border-border pl-4">
              {order.history.map((entry, index): React.JSX.Element => (
                <li key={`${entry.changedAt}-${index}`} className="space-y-1">
                  <OrderStatusBadge status={entry.status} />
                  {entry.changedAt && (
                    <time
                      dateTime={entry.changedAt}
                      className="block text-sm text-muted-foreground"
                    >
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'America/Guayaquil',
                      }).format(new Date(entry.changedAt))}
                    </time>
                  )}
                </li>
              ))}
            </ol>
          )}
        </details>
      </CardContent>

      {showDetailsLink && (
        <div className="px-4 pb-4">
          <Link
            className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
            href={'/purchases/' + order.id}
          >
            {t('viewDetails')}
          </Link>
        </div>
      )}
      <CardFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border bg-muted/10 p-4">
        {paymentsEnabled && normalizedStatus === 'confirmed' && (
          <PayOrderButton orderId={order.id} />
        )}
        {order.canCancel ? (
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">{t('cancelNotice')}</span>
            <CancelOrderDialog orderId={order.id} orderNumber={order.orderNumber} />
          </div>
        ) : isPaid ? (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-2 rounded-md w-full">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{t('paidNotice')}</span>
          </div>
        ) : isInTransitOrDelivered ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
            {isDelivered ? (
              <PackageCheck className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <Truck className="w-4 h-4 shrink-0 text-purple-500" />
            )}
            <span>{t(isDelivered ? 'deliveredNotice' : 'inTransitNotice')}</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground italic w-full">{t('statusAvailable')}</div>
        )}
      </CardFooter>
    </Card>
  );
}
