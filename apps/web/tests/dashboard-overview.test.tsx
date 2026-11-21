import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardOverviewReadModel } from '@canaldigital/packages/core';
import es from '@/messages/es.json';
import { DashboardOverview } from '@/features/dashboard/components/dashboard-overview';
import { TenantScope } from '@/features/dashboard/components/tenant-scope';

vi.mock('next-intl/server', (): object => ({
  getLocale: async (): Promise<string> => 'es',
  getTranslations: async (): Promise<ReturnType<typeof createTranslator>> =>
    createTranslator({ locale: 'es', messages: es.AdminOverview }),
}));
vi.mock('@/features/orders/components/order-status-badge', (): object => ({
  OrderStatusBadge: ({ status }: { status: string }): React.JSX.Element => <span>{status}</span>,
}));

const overview: DashboardOverviewReadModel = {
  kpis: {
    currency: 'USD',
    periodStart: '2026-10-12',
    periodEnd: '2026-10-18',
    revenueCents: 250000,
    previousRevenueCents: 200000,
    revenueChangeBps: 2500,
    excludedCurrencyOrders: 0,
    orderCount: 8,
    lifetimeRevenueCents: 987600,
    lifetimeOrderCount: 41,
    totalCustomers: 17,
    buyingCustomers: 6,
  },
  tenantName: 'Store',
  tenantSlug: 'store',
  observedAt: '2026-10-19T17:00:00Z',
  awaitingPreparation: 0,
  processing: 0,
  shipped: 0,
  pendingPayment: 0,
  activeProducts: 0,
  activeCategories: 0,
  outOfStock: 0,
  withoutImage: 0,
  recentOrders: [],
};
const access = { orders: true, catalog: true, manageCatalog: true };

describe('dashboard overview presentation', (): void => {
  it('places the operational queues before sales and keeps their tenant and filter', async (): Promise<void> => {
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    const content = await DashboardOverview({
      overview,
      access,
      salesFilters: <form aria-label="Filtrar ventas" />,
    });
    const html = renderToStaticMarkup(<TenantScope tenantId={tenantId}>{content}</TenantScope>);

    for (const status of ['paid', 'processing', 'pending_payment']) {
      expect(html).toContain(`href="/dashboard/orders?status=${status}&amp;tenant=${tenantId}"`);
    }
    expect(html.indexOf('?status=paid')).toBeLessThan(html.indexOf('Ingresos del período'));
    expect(html).toContain('Filtrar ventas');
    expect(html.indexOf('Ingresos del período')).toBeLessThan(html.indexOf('Filtrar ventas'));
  });
  it('shows a queue count without linking to a section the member cannot open', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      await DashboardOverview({
        overview: { ...overview, awaitingPreparation: 37 },
        access: { orders: false, catalog: false, manageCatalog: false },
      }),
    );
    expect(html).toContain('37');
    expect(html).not.toContain('href="/dashboard/orders');
    expect(html).not.toContain('href="/dashboard/catalog');
  });
  it('shows channel KPIs: period and lifetime revenue, customers and paid orders', async (): Promise<void> => {
    const html = renderToStaticMarkup(await DashboardOverview({ overview, access }));
    expect(html).toContain('Ingresos del período');
    expect(html).toContain('2500,00');
    expect(html).toContain('Ingresos totales');
    expect(html).toContain('9876,00');
    expect(html).toContain('Clientes totales');
    expect(html).toContain('>17<');
    expect(html).toContain('25');
  });
  it('marks a revenue drop and a missing baseline honestly', async (): Promise<void> => {
    const drop = renderToStaticMarkup(
      await DashboardOverview({
        access,
        overview: { ...overview, kpis: { ...overview.kpis, revenueChangeBps: -1000 } },
      }),
    );
    expect(drop).toContain('text-destructive');
    const none = renderToStaticMarkup(
      await DashboardOverview({
        access,
        overview: { ...overview, kpis: { ...overview.kpis, revenueChangeBps: null } },
      }),
    );
    expect(none).toContain('Sin base de comparación');
  });
  it('shows honest empty states and the first category action', async (): Promise<void> => {
    const html = renderToStaticMarkup(await DashboardOverview({ overview, access }));
    expect(html).toContain('Todavía no hay pedidos');
    expect(html).toContain('Crear primera categoría');
    expect(html).toContain('No tienes pedidos pagados pendientes');
    expect(html).not.toContain('45,678');
    expect(html).not.toContain('Total Revenue');
  });
  it('links recent orders to real details and formats persisted minor units', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      await DashboardOverview({
        access,
        overview: {
          ...overview,
          activeCategories: 2,
          activeProducts: 10,
          awaitingPreparation: 37,
          recentOrders: [
            {
              id: 'real-order',
              orderNumber: 'ORD-42',
              status: 'paid',
              createdAt: '2026-10-19T16:00:00Z',
              customerName: 'Customer',
              currency: 'USD',
              totalAmountCents: 12345,
            },
          ],
        },
      }),
    );
    expect(html).toContain('/dashboard/orders?order=real-order');
    expect(html).toContain('123,45');
    expect(html).toContain('Revisar catálogo');
    expect(html).not.toContain('No tienes pedidos pagados pendientes');
    expect(html).toContain('37');
  });
});
