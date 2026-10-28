import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import { BusinessIntelligenceFilters } from '@/features/dashboard/components/business-intelligence-filters';
import { parseIntelligenceQuery } from '@/features/dashboard/queries/business-intelligence-query';
import { visibleIntelligenceProducts } from '@/features/dashboard/components/business-intelligence-products';
import { BusinessIntelligenceDashboard } from '@/features/dashboard/components/business-intelligence-dashboard';
import { analyzeBusinessIntelligence } from '@/dashboard/domain/business-intelligence';
import es from '@/messages/es.json';

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
        <BusinessIntelligenceFilters query={report.query} />
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
});
