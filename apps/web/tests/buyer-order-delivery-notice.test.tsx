import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import type { BuyerOrderReadModel } from '@canaldigital/packages/core';
import { BuyerOrderCard } from '@/features/orders/components/buyer-order-card';

vi.mock('@/components/ui/card', (): Record<string, string> => ({
  Card: 'article',
  CardHeader: 'header',
  CardContent: 'section',
  CardFooter: 'footer',
  CardTitle: 'h2',
}));
vi.mock('@/features/orders/components/order-status-badge', (): object => ({
  OrderStatusBadge: (): null => null,
}));
vi.mock('@/features/orders/components/cancel-order-dialog', (): object => ({
  CancelOrderDialog: (): null => null,
}));
vi.mock('@/features/payments/components/pay-order-button', (): object => ({
  PayOrderButton: (): null => null,
}));

describe('Buyer order fulfillment notice', (): void => {
  it.each([
    ['es', 'delivered', 'El pedido ya fue entregado.', 'El pedido ya está en camino.'],
    ['es', 'shipped', 'El pedido ya está en camino.', 'El pedido ya fue entregado.'],
    ['en', 'delivered', 'The order has been delivered.', 'The order is already in transit.'],
    ['en', 'shipped', 'The order is already in transit.', 'The order has been delivered.'],
  ])(
    'shows the precise %s %s notice',
    (locale: string, status: string, expected: string, other: string): void => {
      const messages = JSON.parse(
        readFileSync(resolve('apps/web/messages', `${locale}.json`), 'utf8'),
      ) as AbstractIntlMessages;
      const order: BuyerOrderReadModel = {
        id: crypto.randomUUID(),
        orderNumber: 'ORD-DELIVERY',
        tenantId: crypto.randomUUID(),
        tenantName: 'Store',
        tenantSlug: 'store',
        status,
        currency: 'USD',
        totalAmountCents: 100,
        subtotalCents: 100,
        taxAmountCents: 0,
        shippingCostCents: 0,
        createdAt: '2026-10-18T12:00:00Z',
        canCancel: false,
        items: [],
      };
      const markup = renderToStaticMarkup(
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
          <BuyerOrderCard order={order} />
        </NextIntlClientProvider>,
      );
      expect(markup).toContain(expected);
      expect(markup).not.toContain(other);
    },
  );
});
