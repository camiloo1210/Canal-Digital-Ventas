import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import { DashboardOverviewFilters } from '@/features/dashboard/components/dashboard-overview-filters';
import { parseIntelligencePeriod } from '@/features/dashboard/queries/business-intelligence-query';
import { BusinessIntelligenceFilters } from '@/features/dashboard/components/business-intelligence-filters';
import { parseIntelligenceQuery } from '@/features/dashboard/queries/business-intelligence-query';
import { visibleIntelligenceProducts } from '@/features/dashboard/components/business-intelligence-products';
import { BusinessIntelligenceDashboard } from '@/features/dashboard/components/business-intelligence-dashboard';
import { analyzeBusinessIntelligence } from '@/dashboard/domain/business-intelligence';
import es from '@/messages/es.json';

vi.mock('@/features/dashboard/actions/business-advice.actions', (): object => ({
  generateBusinessAdviceAction: vi.fn(),
}));
vi.mock('next-intl/server', (): object => ({
  getTranslations: async (): Promise<
    ReturnType<typeof createTranslator<typeof es.BusinessIntelligence>>
  > => createTranslator({ locale: 'es', messages: es.BusinessIntelligence }),
}));

const report = analyzeBusinessIntelligence(
  {
    observedAt: '2026-10-25T12:00:00Z',
    currency: 'USD',
    orders: [],
    flowOrders: [
      {
        id: 'o1',
        orderNumber: 'ORD-1',
        status: 'paid',
        createdAt: '2026-10-01T00:00:00Z',
        transitions: [{ status: 'paid', at: '2026-10-01T00:00:00Z' }],
      },
    ],
    products: [
      {
        id: 'a',
        name: 'Café orgánico',
        category: 'Bebidas',
        sku: 'COF',
        costCents: 12345,
        priceCents: 18000,
        stock: 0,
        status: 'active',
        hasVariants: false,
      },
      {
        id: 'b',
        name: 'Té',
        category: 'Bebidas',
        sku: 'TEA',
        costCents: 200,
        priceCents: 300,
        stock: 5,
        status: 'active',
        hasVariants: false,
      },
    ],
  },
  { days: 30, leadTimeDays: 7, targetCoverageDays: 30 },
);

describe('business intelligence delivery', (): void => {
  it('parses GET primitives and safely defaults malformed and repeated values', (): void => {
    expect(
      parseIntelligenceQuery({ days: '90', leadTimeDays: '14', targetCoverageDays: '45' }),
    ).toEqual({ days: 90, leadTimeDays: 14, targetCoverageDays: 45 });
    expect(
      parseIntelligenceQuery({ days: ['7', '90'], leadTimeDays: '-1', targetCoverageDays: 'oops' }),
    ).toEqual({ days: 30, leadTimeDays: 7, targetCoverageDays: 30 });
  });
  it('searches names, SKU and categories and filters precomputed signals', (): void => {
    expect(
      visibleIntelligenceProducts(report.products, 'cafe', 'all', 'revenue').map(
        (p): string => p.id,
      ),
    ).toEqual(['a']);
    expect(
      visibleIntelligenceProducts(report.products, 'tea', 'all', 'revenue').map(
        (p): string => p.id,
      ),
    ).toEqual(['b']);
    expect(
      visibleIntelligenceProducts(report.products, '', 'outOfStock', 'revenue').map(
        (p): string => p.id,
      ),
    ).toEqual(['a']);
    expect(visibleIntelligenceProducts(report.products, 'missing', 'all', 'revenue')).toEqual([]);
    expect(
      visibleIntelligenceProducts(
        [
          { ...report.products[0], estimatedProfitCents: 800 },
          { ...report.products[1], estimatedProfitCents: -200 },
        ],
        '',
        'all',
        'lowestProfit',
      ).map((product): string => product.id),
    ).toEqual(['b', 'a']);
  });
  it('renders honest empty data, assumptions, localized controls and product actions', async (): Promise<void> => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="es" messages={es} timeZone="UTC">
        <BusinessIntelligenceDashboard report={report} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('Sin ventas en este período');
    expect(html).toContain('costos actuales');
    expect(html).toContain('Café orgánico');
    expect(html).toContain('/dashboard/catalog/products/a/edit');
    const filters = renderToStaticMarkup(
      <NextIntlClientProvider locale="es" messages={es} timeZone="UTC">
        <BusinessIntelligenceFilters query={report.query} maxDate="2026-10-25" />
      </NextIntlClientProvider>,
    );
    expect(filters).toContain('name="leadTimeDays"');
    expect(filters).toContain('value="30"');
    expect(html).toContain('Sin base de comparación');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });
  it('exposes comparative chart controls, rankings and separate inventory columns', (): void => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="es" messages={es} timeZone="UTC">
        <BusinessIntelligenceDashboard report={report} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('Período anterior');
    expect(html).toContain('Productos que impulsan tus ventas');
    expect(html).toContain('Rendimiento');
    expect(html).toContain('Inventario');
    expect(html).toContain('Cómo calculamos los indicadores');
  });
  it('accepts a valid custom date range and falls back to presets when it is invalid', (): void => {
    const now = new Date('2026-10-25T12:00:00Z');
    expect(
      parseIntelligenceQuery({ from: '2026-10-01', to: '2026-10-10', days: '7' }, now),
    ).toMatchObject({ days: 10, endDate: '2026-10-10' });
    for (const bad of [
      { from: '2026-10-10', to: '2026-10-01' },
      { from: '2026-10-01', to: '2026-10-26' },
      { from: '2025-01-01', to: '2026-10-25' },
      { from: '2026-02-30', to: '2026-03-02' },
      { from: 'x', to: '2026-10-10' },
      { from: '2026-10-01' },
    ])
      expect(parseIntelligenceQuery({ ...bad, days: '7' }, now)).toEqual({
        days: 7,
        leadTimeDays: 7,
        targetCoverageDays: 30,
      });
  });
  it('renders the order flow section', (): void => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="es" messages={es}>
        <BusinessIntelligenceDashboard report={report} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain(es.BusinessIntelligence.flowTitle);
    expect(html).toContain(es.BusinessIntelligence.flowStatus.paid);
  });
  it('renders the date range inputs bound to the active custom range', (): void => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="es" messages={es}>
        <BusinessIntelligenceFilters
          query={{ days: 10, endDate: '2026-10-10', leadTimeDays: 7, targetCoverageDays: 30 }}
          maxDate="2026-10-25"
        />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('name="from"');
    expect(html).toContain('value="2026-10-01"');
    expect(html).toContain('value="2026-10-10"');
    expect(html).toContain('max="2026-10-25"');
  });
  it('parses the overview period with the same range rules', (): void => {
    const now = new Date('2026-10-25T12:00:00Z');
    expect(parseIntelligencePeriod({ days: '90' }, now)).toEqual({ days: 90 });
    expect(parseIntelligencePeriod({ from: '2026-10-01', to: '2026-10-10' }, now)).toEqual({
      days: 10,
      endDate: '2026-10-10',
    });
    expect(parseIntelligencePeriod({ from: '2026-10-10', to: '2026-10-01' }, now)).toEqual({
      days: 30,
    });
  });
  it('renders overview date filters bound to the active range', (): void => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="es" messages={es}>
        <DashboardOverviewFilters
          period={{ days: 10, endDate: '2026-10-10' }}
          maxDate="2026-10-25"
        />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('action="/dashboard"');
    expect(html).toContain('name="from"');
    expect(html).toContain('value="2026-10-01"');
    expect(html).toContain('value="2026-10-10"');
    expect(html).toContain('max="2026-10-25"');
  });
});
