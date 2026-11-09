import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import es from '@/messages/es.json';
import {
  parseSellerOrdersQuery,
  sellerOrdersHref,
} from '@/features/orders/queries/seller-orders-query';
import { SellerOrdersTable } from '@/features/orders/components/seller-orders-table';
import { SellerOrderDetails } from '@/features/orders/components/seller-order-details';
import type { SellerOrderReadModel } from '@canaldigital/packages/core';

vi.mock('next-intl/server', (): object => ({
  getLocale: async (): Promise<string> => 'es',
  getTranslations: async (): Promise<ReturnType<typeof createTranslator<typeof es.AdminOrders>>> =>
    createTranslator({ locale: 'es', messages: es.AdminOrders }),
}));
vi.mock('@/features/orders/components/buyer-tracking-timeline', (): object => ({
  BuyerTrackingTimeline: (): React.JSX.Element => <span>tracking-timeline</span>,
}));
vi.mock('@/features/orders/components/seller-tracking-form', (): object => ({
  SellerTrackingForm: (): React.JSX.Element => <span>tracking-control</span>,
}));
vi.mock('@/features/orders/components/manual-shipment-form', (): object => ({
  ManualShipmentForm: (): null => null,
}));
vi.mock('@/features/orders/components/seller-order-status-form', (): object => ({
  SellerOrderStatusForm: (): null => null,
}));
vi.mock('@/features/orders/components/order-status-badge', (): object => ({
  OrderStatusBadge: ({ status }: { status: string }): React.JSX.Element => <span>{status}</span>,
}));

const order: SellerOrderReadModel = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  orderNumber: 'ORD-51',
  status: 'paid',
  nextStatus: 'processing',
  version: 4,
  totalAmountCents: 12345,
  currency: 'EUR',
  createdAt: '2026-10-19T12:00:00Z',
  customerName: 'Customer',
  shippingAddress: 'Private address only shown in details',
  items: [{ id: 'item', productName: 'Private product detail', quantity: 2 }],
};

describe('seller order URL and queue', (): void => {
  it('shows available tracking to an authorized read-only seller', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      await SellerOrderDetails({
        order: { ...order, canManageShipment: false },
        tracking: { state: 'pending', lastSuccessfulAt: null, events: [] },
      }),
    );
    expect(html).toContain('tracking-timeline');
    expect(html).not.toContain('tracking-control');
  });
  it('only shows tracking activation to managers with a guide when the sandbox is configured', async (): Promise<void> => {
    const shipment = { carrier: 'FedEx', trackingNumber: '123', version: 2 };
    const allowed = renderToStaticMarkup(
      await SellerOrderDetails({
        order: { ...order, canManageShipment: true, shipment },
        trackingEnabled: true,
      }),
    );
    const viewer = renderToStaticMarkup(
      await SellerOrderDetails({
        order: { ...order, canManageShipment: false, shipment },
        trackingEnabled: true,
      }),
    );
    const disabled = renderToStaticMarkup(
      await SellerOrderDetails({
        order: { ...order, canManageShipment: true, shipment },
        trackingEnabled: false,
      }),
    );
    expect(allowed).toContain('tracking-control');
    expect(viewer).not.toContain('tracking-control');
    expect(disabled).not.toContain('tracking-control');
  });
  it('tells the seller when shipment storage is unavailable', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      await SellerOrderDetails({
        order: {
          ...order,
          canManageShipment: false,
          nextStatus: null,
          shipmentAvailability: 'unavailable',
        },
      }),
    );
    expect(html).toContain('Los datos del envío no están disponibles en este momento.');
  });
  it('shows stored shipment details to an authorized read-only viewer', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      await SellerOrderDetails({
        order: {
          ...order,
          canManageShipment: false,
          nextStatus: null,
          shipment: { carrier: 'Carrier Example', trackingNumber: 'ABC-123', version: 2 },
        },
      }),
    );
    expect(html).toContain('Carrier Example');
    expect(html).toContain('ABC-123');
  });
  it('normalizes malformed parameters and only accepts implemented statuses and UUID detail links', (): void => {
    expect(
      parseSellerOrdersQuery({ page: '-4', status: 'invented', order: 'injected', q: ['a', 'b'] }),
    ).toEqual({ q: '', status: 'all', page: 1, order: null, tenant: null });
    expect(
      parseSellerOrdersQuery({ order: order.id, page: '3', status: 'processing' }),
    ).toMatchObject({ order: order.id, page: 3, status: 'processing' });
  });
  it('preserves filters and page when opening details and removes only the detail parameter when closing', (): void => {
    const query = parseSellerOrdersQuery({ q: 'A&B', status: 'paid', page: '3' });
    expect(sellerOrdersHref(query, { order: order.id })).toBe(
      '/dashboard/orders?q=A%26B&status=paid&page=3&order=' + order.id,
    );
    expect(sellerOrdersHref({ ...query, order: order.id }, { order: null })).toBe(
      '/dashboard/orders?q=A%26B&status=paid&page=3',
    );
  });
  it('keeps the explicit business on every link and ignores a malformed one', (): void => {
    const tenant = '3f2b8c1e-9a4d-4e2b-8c7a-1d2e3f4a5b6c';
    const query = parseSellerOrdersQuery({ status: 'paid', tenant });
    expect(query.tenant).toBe(tenant);
    expect(sellerOrdersHref(query, { order: order.id })).toBe(
      '/dashboard/orders?status=paid&order=' + order.id + '&tenant=' + tenant,
    );
    expect(parseSellerOrdersQuery({ tenant: 'x' }).tenant).toBeNull();
  });
  it('keeps the queue compact and links to scoped details without exposing all addresses and lines in the list', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      await SellerOrdersTable({
        orders: [order],
        query: parseSellerOrdersQuery({ status: 'paid' }),
      }),
    );
    expect(html).toContain('ORD-51');
    expect(html).toContain('123,45');
    expect(html).toContain('€');
    expect(html).toContain('status=paid&amp;order=' + order.id);
    expect(html).not.toContain('Private address');
    expect(html).not.toContain('Private product');
  });
});
