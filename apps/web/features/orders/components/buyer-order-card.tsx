'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import type { BuyerOrderReadModel } from '@canaldigital/packages/core';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import { CancelOrderDialog } from '@/features/orders/components/cancel-order-dialog';
import { PayOrderButton } from '@/features/payments/components/pay-order-button';
import { Store, Calendar, Package, AlertCircle, Truck } from 'lucide-react';

interface BuyerOrderCardProps {
  order: BuyerOrderReadModel;
  paymentsEnabled?: boolean;
}

export function BuyerOrderCard({
  order,
  paymentsEnabled = false,
}: BuyerOrderCardProps): React.JSX.Element {
  const t = useTranslations('Orders.card');
  const locale = useLocale();

  const formatMoney = (cents: number): string => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: order.currency,
    }).format(cents / 100);
  };

  const formattedDate = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(order.createdAt));

  const normalizedStatus = order.status.toLowerCase();
  const isPaid = normalizedStatus === 'paid';
  const isInTransitOrDelivered = normalizedStatus === 'shipped' || normalizedStatus === 'delivered';

  return (
    <Card className="shadow-sm border-border hover:shadow-md transition-shadow duration-200">
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
              {formatMoney(order.totalAmountCents)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
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
                    {formatMoney(item.subtotalCents)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs text-muted-foreground border-t border-border/40">
          <div>
            <span>{t('subtotal')}: </span>
            <span className="font-medium text-foreground">{formatMoney(order.subtotalCents)}</span>
          </div>
          <div>
            <span>{t('tax')}: </span>
            <span className="font-medium text-foreground">{formatMoney(order.taxAmountCents)}</span>
          </div>
          <div>
            <span>{t('shipping')}: </span>
            <span className="font-medium text-foreground">
              {formatMoney(order.shippingCostCents)}
            </span>
          </div>
          <div className="text-right sm:text-left">
            <span>{t('total')}: </span>
            <span className="font-bold text-foreground">{formatMoney(order.totalAmountCents)}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border bg-muted/10 p-4">
        {paymentsEnabled && normalizedStatus === 'confirmed' && (
          <PayOrderButton orderId={order.id} />
        )}
        {order.canCancel ? (
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">
              ¿Deseas anular esta compra? Puedes cancelarla antes de su despacho.
            </span>
            <CancelOrderDialog orderId={order.id} orderNumber={order.orderNumber} />
          </div>
        ) : isPaid ? (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-2 rounded-md w-full">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{t('paidNotice')}</span>
          </div>
        ) : isInTransitOrDelivered ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
            <Truck className="w-4 h-4 shrink-0 text-purple-500" />
            <span>{t('inTransitNotice')}</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground italic w-full">
            Estado actual: {order.status}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
