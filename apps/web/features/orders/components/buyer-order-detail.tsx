'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertCircle,
  CreditCard,
  ImageOff,
  MapPin,
  PackageCheck,
  Printer,
  RotateCw,
  Store,
  Truck,
} from 'lucide-react';
import type { BuyerOrderReadModel, TrackingReadModel } from '@canaldigital/packages/core';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/lib/money';
import { BuyerOrderProgress } from '@/features/orders/components/buyer-order-progress';
import { BuyerTrackingTimeline } from '@/features/orders/components/buyer-tracking-timeline';
import { CancelOrderDialog } from '@/features/orders/components/cancel-order-dialog';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import { PayOrderButton } from '@/features/payments/components/pay-order-button';

interface BuyerOrderDetailProps {
  readonly order: BuyerOrderReadModel;
  readonly tracking: TrackingReadModel | null;
  readonly trackingUnavailable: boolean;
  readonly paymentsEnabled: boolean;
}

const HEADLINE_STATUSES = [
  'draft',
  'confirmed',
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly strong?: boolean;
}): React.JSX.Element {
  return (
    <div className={'flex justify-between gap-3 ' + (strong ? 'text-base font-bold' : 'text-sm')}>
      <dt className={strong ? undefined : 'text-muted-foreground'}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function BuyerOrderDetail({
  order,
  tracking,
  trackingUnavailable,
  paymentsEnabled,
}: BuyerOrderDetailProps): React.JSX.Element {
  const t = useTranslations('Orders.detail');
  const card = useTranslations('Orders.card');
  const trackingText = useTranslations('ShipmentTracking');
  const locale = useLocale();
  const money = (cents: number): string => formatMoney(cents, order.currency, locale);
  const normalized = order.status.toLowerCase();
  const headlineKey = (HEADLINE_STATUSES as readonly string[]).includes(normalized)
    ? normalized
    : 'unknown';
  const placedOn = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: 'America/Guayaquil',
  }).format(new Date(order.createdAt));
  const isPaid = normalized === 'paid';
  const isShipped = normalized === 'shipped';
  const isDelivered = normalized === 'delivered';
  const hasTrackingNumber = Boolean(order.shipment?.trackingNumber);
  const itemCount = order.items.reduce((sum, item): number => sum + item.quantity, 0);

  return (
    <div className="space-y-6">
      <section
        aria-label={t('summaryBar')}
        className="grid gap-4 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('placedOn')}
          </p>
          <p className="mt-1 text-sm font-medium">{placedOn}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {card('total')}
          </p>
          <p className="mt-1 text-sm font-medium tabular-nums">{money(order.totalAmountCents)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('shipTo')}
          </p>
          <p className="mt-1 line-clamp-2 break-words text-sm font-medium">
            {order.shippingAddress ?? t('addressUnavailable')}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('orderNumber')}
          </p>
          <p className="mt-1 break-all text-sm font-medium">{order.orderNumber}</p>
          <Link
            href={`/store/${order.tenantSlug}`}
            className="mt-1 inline-flex min-h-6 items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            <Store className="size-3.5" aria-hidden="true" />
            {order.tenantName}
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl font-semibold">
                  {t(`headline.${headlineKey}`)}
                </CardTitle>
                <OrderStatusBadge status={order.status} />
              </div>
              {order.nextStep && (
                <p className="text-sm text-muted-foreground">
                  {card(`nextStep.${order.nextStep}`)}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              <BuyerOrderProgress status={order.status} />
              {order.shipment && (hasTrackingNumber || order.shipment.carrier) && (
                <dl className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2">
                  {order.shipment.carrier && (
                    <div>
                      <dt className="text-muted-foreground">{card('shipmentCarrier')}</dt>
                      <dd className="mt-0.5 break-words font-medium">{order.shipment.carrier}</dd>
                    </div>
                  )}
                  {order.shipment.trackingNumber && (
                    <div>
                      <dt className="text-muted-foreground">{card('shipmentTracking')}</dt>
                      <dd className="mt-0.5 break-all font-medium">
                        {order.shipment.trackingNumber}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
              {!order.shipment && (
                <p className="text-sm text-muted-foreground">
                  {card(
                    order.shipmentAvailability === 'unavailable'
                      ? 'shipmentUnavailable'
                      : 'shipmentMissing',
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          {tracking && <BuyerTrackingTimeline tracking={tracking} />}
          {trackingUnavailable && (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground">
              {trackingText('unavailable')}
            </p>
          )}

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">
                {card('items')} · {t('itemCount', { count: itemCount })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {order.items.map((item): React.JSX.Element => {
                  const productHref = `/store/${order.tenantSlug}/products/${item.productId}`;
                  return (
                    <li key={item.id} className="flex gap-4 py-4 first:pt-4">
                      <Link
                        href={productHref}
                        aria-label={t('viewProduct', { name: item.productName })}
                        className="relative size-24 shrink-0 overflow-hidden rounded-xl border bg-muted/40 sm:size-28"
                      >
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.productName}
                            fill
                            className="object-cover"
                            sizes="(min-width: 640px) 112px, 96px"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center">
                            <ImageOff className="size-6 opacity-30" aria-label={card('noImage')} />
                          </span>
                        )}
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                        <div className="space-y-1">
                          <Link
                            href={productHref}
                            className="line-clamp-2 text-sm font-semibold underline-offset-4 hover:underline sm:text-base"
                          >
                            {item.productName}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {card('quantityAt', {
                              quantity: item.quantity,
                              price: money(item.unitPriceCents),
                            })}
                          </p>
                          <p className="text-sm font-semibold tabular-nums">
                            {money(item.subtotalCents)}
                          </p>
                        </div>
                        <Link
                          href={productHref}
                          className={
                            buttonVariants({ variant: 'outline' }) + ' min-h-11 w-fit print:hidden'
                          }
                        >
                          <RotateCw aria-hidden="true" />
                          {t('buyAgain')}
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer rounded-sm text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              {card('activityTitle')}
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">{card('activityDisclaimer')}</p>
            {order.history === null ? (
              <p className="mt-3 text-sm text-muted-foreground">{card('activityUnavailable')}</p>
            ) : order.history.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{card('activityEmpty')}</p>
            ) : (
              <ol className="mt-3 space-y-3 border-l pl-4">
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
        </div>

        <aside aria-label={t('summaryTitle')} className="space-y-4 lg:sticky lg:top-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">{t('summaryTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="space-y-2">
                <SummaryRow label={card('subtotal')} value={money(order.subtotalCents)} />
                <SummaryRow label={card('tax')} value={money(order.taxAmountCents)} />
                <SummaryRow label={card('shipping')} value={money(order.shippingCostCents)} />
                <div className="border-t pt-2">
                  <SummaryRow strong label={card('total')} value={money(order.totalAmountCents)} />
                </div>
              </dl>
              <div className="flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-sm">
                <CreditCard
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <p>
                  <span className="text-muted-foreground">{card('paymentTitle')}: </span>
                  <span className="font-medium">
                    {card(`paymentStatus.${order.paymentStatus ?? 'unavailable'}`)}
                  </span>
                </p>
              </div>
              {order.shippingAddress && (
                <div className="flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-sm">
                  <MapPin
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-muted-foreground">{card('deliveryAddress')}</p>
                    <p className="mt-0.5 break-words font-medium">{order.shippingAddress}</p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={(): void => window.print()}
                className={buttonVariants({ variant: 'outline' }) + ' min-h-11 w-full print:hidden'}
              >
                <Printer aria-hidden="true" />
                {t('print')}
              </button>
              <p className="text-xs text-muted-foreground">{t('printNote')}</p>
            </CardContent>
          </Card>

          <div className="space-y-3 print:hidden">
            {paymentsEnabled && normalized === 'confirmed' && <PayOrderButton orderId={order.id} />}
            {order.canCancel ? (
              <div className="space-y-2 rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">{card('cancelNotice')}</p>
                <CancelOrderDialog orderId={order.id} orderNumber={order.orderNumber} />
              </div>
            ) : isPaid ? (
              <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {card('paidNotice')}
              </p>
            ) : isShipped || isDelivered ? (
              <p className="flex items-start gap-2 rounded-xl border p-3 text-sm text-muted-foreground">
                {isDelivered ? (
                  <PackageCheck
                    className="mt-0.5 size-4 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                ) : (
                  <Truck className="mt-0.5 size-4 shrink-0 text-purple-500" aria-hidden="true" />
                )}
                {card(isDelivered ? 'deliveredNotice' : 'inTransitNotice')}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">{card('helpUnavailable')}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
