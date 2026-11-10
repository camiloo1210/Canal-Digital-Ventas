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

function render(status: string, showDetailsLink: boolean): string {
  const messages = JSON.parse(
    readFileSync(resolve('apps/web/messages', 'es.json'), 'utf8'),
  ) as AbstractIntlMessages;
  const order: BuyerOrderReadModel = {
    id: 'one',
    orderNumber: 'ORD-1',
    tenantId: 'tenant',
    tenantName: 'Store',
    tenantSlug: 'store',
    shipment: { carrier: 'FedEx', trackingNumber: 'ABC-123' },
    status,
    currency: 'USD',
    totalAmountCents: 2500,
    subtotalCents: 2500,
    taxAmountCents: 0,
    shippingCostCents: 0,
    createdAt: '2026-11-08T00:00:00Z',
    canCancel: false,
    history: [],
    items: [
      {
        id: 'i1',
        productId: 'p1',
        productName: 'Camiseta azul',
        quantity: 2,
        unitPriceCents: 1000,
        subtotalCents: 2000,
        imageUrl: 'https://abc.supabase.co/storage/v1/object/public/products/shirt.jpg',
      },
      {
        id: 'i2',
        productId: 'p2',
        productName: 'Gorra sin foto',
        quantity: 1,
        unitPriceCents: 500,
        subtotalCents: 500,
        imageUrl: null,
      },
    ],
  };
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
      <BuyerOrderCard order={order} showDetailsLink={showDetailsLink} />
    </NextIntlClientProvider>,
  );
}

describe('Buyer order card items and progress', (): void => {
  it('shows each product image with its name, quantity and unit price', (): void => {
    const markup = render('processing', false);
    expect(markup).toContain('alt="Camiseta azul"');
    expect(markup).toContain('shirt.jpg');
    expect(markup).toContain('Cantidad: 2');
    expect(markup).toContain('Gorra sin foto');
    expect(markup).toContain('aria-label="Sin imagen"');
  });
  it('shows the progress bar on the detail view with the current step', (): void => {
    const markup = render('shipped', false);
    expect(markup).toContain('Progreso del pedido');
    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain('Enviado');
  });
  it('hides the progress bar for cancelled orders and in the list view', (): void => {
    expect(render('cancelled', false)).not.toContain('Progreso del pedido');
    expect(render('shipped', true)).not.toContain('Progreso del pedido');
  });
  it('no longer says shipping data is manual or not live tracking', (): void => {
    expect(render('shipped', false)).not.toContain('No es seguimiento en tiempo real');
  });
});
