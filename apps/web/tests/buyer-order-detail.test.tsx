import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import type { BuyerOrderReadModel } from '@canaldigital/packages/core';
import { BuyerOrderDetail } from '@/features/orders/components/buyer-order-detail';

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
  CancelOrderDialog: (): React.JSX.Element => <button type="button">cancel-dialog</button>,
}));
vi.mock('@/features/payments/components/pay-order-button', (): object => ({
  PayOrderButton: (): null => null,
}));
vi.mock('@/features/orders/components/buyer-tracking-timeline', (): object => ({
  BuyerTrackingTimeline: (): React.JSX.Element => <section>tracking-timeline</section>,
}));

function order(overrides: Partial<BuyerOrderReadModel> = {}): BuyerOrderReadModel {
  return {
    id: 'one',
    orderNumber: 'ORD-1',
    tenantId: 'tenant',
    tenantName: 'Mi Tienda',
    tenantSlug: 'mi-tienda',
    status: 'shipped',
    currency: 'USD',
    totalAmountCents: 2500,
    subtotalCents: 2000,
    taxAmountCents: 300,
    shippingCostCents: 200,
    createdAt: '2026-11-08T12:00:00Z',
    canCancel: false,
    history: [],
    shippingAddress: 'Calle 1 #2-3, Bogotá',
    paymentStatus: 'completed',
    shipment: { carrier: 'FedEx', trackingNumber: 'ABC-123' },
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
    ],
    ...overrides,
  };
}

function render(value: BuyerOrderReadModel, tracking = false): string {
  const messages = JSON.parse(
    readFileSync(resolve('apps/web/messages', 'es.json'), 'utf8'),
  ) as AbstractIntlMessages;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
      <BuyerOrderDetail
        order={value}
        tracking={tracking ? { state: 'current', lastSuccessfulAt: null, events: [] } : null}
        trackingUnavailable={false}
        paymentsEnabled={false}
      />
    </NextIntlClientProvider>,
  );
}

describe('Buyer order detail', (): void => {
  it('shows the order summary bar with date, total, address and order number', (): void => {
    const markup = render(order());
    expect(markup).toContain('Pedido realizado');
    expect(markup).toContain('Calle 1 #2-3, Bogotá');
    expect(markup).toContain('ORD-1');
    expect(markup).toContain('Mi Tienda');
  });
  it('shows a status headline, the progress bar and the carrier data', (): void => {
    const markup = render(order());
    expect(markup).toContain('Tu pedido va en camino');
    expect(markup).toContain('Progreso del pedido');
    expect(markup).toContain('FedEx');
    expect(markup).toContain('ABC-123');
  });
  it('links each product image and name to its store page and offers buying again', (): void => {
    const markup = render(order());
    expect(markup).toContain('href="/store/mi-tienda/products/p1"');
    expect(markup).toContain('alt="Camiseta azul"');
    expect(markup).toContain('Comprar de nuevo');
  });
  it('shows the money breakdown, payment status and the non-invoice note', (): void => {
    const markup = render(order());
    expect(markup).toContain('Subtotal');
    expect(markup).toContain('Imprimir resumen');
    expect(markup).toContain('no reemplaza una factura');
  });
  it('renders the tracking timeline only when tracking data exists', (): void => {
    expect(render(order(), true)).toContain('tracking-timeline');
    expect(render(order(), false)).not.toContain('tracking-timeline');
  });
  it('offers cancellation only when the order can be cancelled', (): void => {
    expect(render(order({ canCancel: true, status: 'confirmed' }))).toContain('cancel-dialog');
    expect(render(order())).not.toContain('cancel-dialog');
  });
  it('shows a cancelled headline without a progress bar', (): void => {
    const markup = render(order({ status: 'cancelled' }));
    expect(markup).toContain('Pedido cancelado');
    expect(markup).not.toContain('Progreso del pedido');
  });
});
