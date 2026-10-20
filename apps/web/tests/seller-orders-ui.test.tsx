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
import type { SellerOrderReadModel } from '@canaldigital/packages/core';

vi.mock('next-intl/server', (): object => ({
  getLocale: async (): Promise<string> => 'es',
  getTranslations: async (): Promise<ReturnType<typeof createTranslator<typeof es.AdminOrders>>> =>
    createTranslator({ locale: 'es', messages: es.AdminOrders }),
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
  it('normalizes malformed parameters and only accepts implemented statuses and UUID detail links', (): void => {
    expect(
      parseSellerOrdersQuery({ page: '-4', status: 'invented', order: 'injected', q: ['a', 'b'] }),
    ).toEqual({ q: '', status: 'all', page: 1, order: null });
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
