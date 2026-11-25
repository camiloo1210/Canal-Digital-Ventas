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
  it('renders recorded activity without claiming the history is complete', (): void => {
    const messages = JSON.parse(
      readFileSync(resolve('apps/web/messages', 'es.json'), 'utf8'),
    ) as AbstractIntlMessages;
    const order: BuyerOrderReadModel = {
      id: 'one',
      orderNumber: 'ORD-1',
      tenantId: 'tenant',
      tenantName: 'Store',
      tenantSlug: 'store',
      shipment: { carrier: 'Carrier Example', trackingNumber: 'ABC-123' },
      status: 'cancelled',
      currency: 'USD',
      totalAmountCents: 100,
      subtotalCents: 100,
      taxAmountCents: 0,
      shippingCostCents: 0,
      createdAt: '2026-11-08T00:00:00Z',
      canCancel: false,
      items: [],
      history: [{ status: 'cancelled', changedAt: '2026-11-08T01:00:00Z' }],
    };
    const markup = renderToStaticMarkup(
      <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
        <BuyerOrderCard order={order} />
      </NextIntlClientProvider>,
    );
    expect(markup).toContain('Actividad del pedido');
    expect(markup).toContain('Carrier Example');
    expect(markup).toContain('ABC-123');
    expect(markup).toContain(
      'Es posible que no estén disponibles todas las actualizaciones anteriores.',
    );
    expect(markup).toContain('2026-11-08T01:00:00Z');
    expect(markup).not.toContain('La tienda marcó este pedido como entregado.');
  });

  it('shows the delivery address in the purchase detail', (): void => {
    const messages = JSON.parse(
      readFileSync(resolve('apps/web/messages', 'es.json'), 'utf8'),
    ) as AbstractIntlMessages;
    const order: BuyerOrderReadModel = {
      id: 'one',
      orderNumber: 'ORD-1',
      tenantId: 'tenant',
      tenantName: 'Store',
      tenantSlug: 'store',
      status: 'confirmed',
      currency: 'USD',
      totalAmountCents: 100,
      subtotalCents: 100,
      taxAmountCents: 0,
      shippingCostCents: 0,
      createdAt: '2026-11-08T00:00:00Z',
      canCancel: false,
      items: [],
      history: [],
      shippingAddress: 'Calle 1, Quito, Ecuador',
      paymentStatus: 'completed',
    };
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
        <BuyerOrderCard order={order} showDetailsLink={false} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('Calle 1, Quito, Ecuador');
    expect(html).toContain('Pago confirmado');
    expect(html).toContain('No hay un canal de ayuda confirmado para este pedido.');
  });
  it('explains when shipment data is unavailable', (): void => {
    const messages = JSON.parse(
      readFileSync(resolve('apps/web/messages', 'es.json'), 'utf8'),
    ) as AbstractIntlMessages;
    const order: BuyerOrderReadModel = {
      id: 'one',
      orderNumber: 'ORD-1',
      tenantId: 'tenant',
      tenantName: 'Store',
      tenantSlug: 'store',
      status: 'confirmed',
      currency: 'USD',
      totalAmountCents: 100,
      subtotalCents: 100,
      taxAmountCents: 0,
      shippingCostCents: 0,
      createdAt: '2026-11-08T00:00:00Z',
      canCancel: false,
      items: [],
      history: [],
      shipmentAvailability: 'unavailable',
    };
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
        <BuyerOrderCard order={order} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('Los datos del envío no están disponibles en este momento.');
  });
  it('explains when order activity is unavailable', (): void => {
    const messages = JSON.parse(
      readFileSync(resolve('apps/web/messages', 'es.json'), 'utf8'),
    ) as AbstractIntlMessages;
    const order: BuyerOrderReadModel = {
      id: 'one',
      orderNumber: 'ORD-1',
      tenantId: 'tenant',
      tenantName: 'Store',
      tenantSlug: 'store',
      status: 'confirmed',
      currency: 'USD',
      totalAmountCents: 100,
      subtotalCents: 100,
      taxAmountCents: 0,
      shippingCostCents: 0,
      createdAt: '2026-11-08T00:00:00Z',
      canCancel: false,
      items: [],
      history: null,
    };
    const markup = renderToStaticMarkup(
      <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
        <BuyerOrderCard order={order} />
      </NextIntlClientProvider>,
    );
    expect(markup).toContain('La actividad no está disponible en este momento.');
    expect(markup).not.toContain('Aún no hay actualizaciones disponibles.');
  });
  it.each([
    [
      'es',
      'delivered',
      'La tienda marcó este pedido como entregado.',
      'La tienda marcó este pedido como enviado.',
    ],
    [
      'es',
      'shipped',
      'La tienda marcó este pedido como enviado.',
      'La tienda marcó este pedido como entregado.',
    ],
    [
      'en',
      'delivered',
      'The store marked this order as delivered.',
      'The store marked this order as shipped.',
    ],
    [
      'en',
      'shipped',
      'The store marked this order as shipped.',
      'The store marked this order as delivered.',
    ],
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
        history: [],
        items: [],
      };
      const markup = renderToStaticMarkup(
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
          <BuyerOrderCard order={order} />
        </NextIntlClientProvider>,
      );
      expect(markup).toContain(expected);
      expect(markup).toContain(
        locale === 'es'
          ? 'Aún no hay actualizaciones disponibles.'
          : 'No updates are available yet.',
      );
      expect(markup).not.toContain(other);
    },
  );
  it.each([
    ['es', 'Consulta la actividad para conocer las actualizaciones del pedido.'],
    ['en', 'Check the activity for order updates.'],
  ])(
    'shows a localized notice for a non-cancellable processing order in %s',
    (locale: string, expected: string): void => {
      const messages = JSON.parse(
        readFileSync(resolve('apps/web/messages', `${locale}.json`), 'utf8'),
      ) as AbstractIntlMessages;
      const order: BuyerOrderReadModel = {
        id: 'one',
        orderNumber: 'ORD-1',
        tenantId: 'tenant',
        tenantName: 'Store',
        tenantSlug: 'store',
        status: 'processing',
        currency: 'USD',
        totalAmountCents: 100,
        subtotalCents: 100,
        taxAmountCents: 0,
        shippingCostCents: 0,
        createdAt: '2026-11-08T00:00:00Z',
        canCancel: false,
        history: [],
        items: [],
      };
      const markup = renderToStaticMarkup(
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
          <BuyerOrderCard order={order} />
        </NextIntlClientProvider>,
      );
      expect(markup).toContain(expected);
      expect(markup).not.toContain('processing');
    },
  );
});
