import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { createTranslator } from 'next-intl';
import BusinessIntelligencePage from '@/app/(dashboard)/dashboard/business-intelligence/page';
import { BusinessIntelligenceFilters } from '@/features/dashboard/components/business-intelligence-filters';
import type { IntelligenceQuery } from '@canaldigital/packages/core';
import es from '@/messages/es.json';

vi.mock('@/components/page-header', (): object => ({ PageHeader: (): null => null }));

vi.mock('next-intl/server', (): object => ({
  getTranslations: async (): Promise<
    ReturnType<typeof createTranslator<typeof es.BusinessIntelligence>>
  > => createTranslator({ locale: 'es', messages: es.BusinessIntelligence }),
}));
vi.mock('@/features/dashboard/queries/dashboard-context.query', (): object => ({
  requireDashboardTenant: async (): Promise<{ userId: string; tenantId: string }> => ({
    userId: 'actor',
    tenantId: 'tenant',
  }),
}));
vi.mock('@/features/dashboard/components/business-intelligence-results', (): object => ({
  BusinessIntelligenceResults: (): null => null,
}));

function findFilters(
  node: React.ReactNode,
): React.ReactElement<{ query: IntelligenceQuery }> | null {
  let result: React.ReactElement<{ query: IntelligenceQuery }> | null = null;
  React.Children.forEach(node, (child): void => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return;
    if (child.type === BusinessIntelligenceFilters)
      result = child as React.ReactElement<{ query: IntelligenceQuery }>;
    else result = result ?? findFilters(child.props.children);
  });
  return result;
}

describe('business intelligence navigation identity', (): void => {
  it('updates applied query props without replacing the whole filter form during navigation', async (): Promise<void> => {
    const before = findFilters(
      await BusinessIntelligencePage({ searchParams: Promise.resolve({ days: '7' }) }),
    );
    const after = findFilters(
      await BusinessIntelligencePage({ searchParams: Promise.resolve({ days: '90' }) }),
    );
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(before?.key).toBe(after?.key);
    expect(before?.props.query.days).toBe(7);
    expect(after?.props.query.days).toBe(90);
  });
});
