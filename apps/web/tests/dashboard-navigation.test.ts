import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  dashboardNavigation,
  groupDashboardNavigation,
  isDashboardDestinationActive,
} from '@/features/dashboard/navigation/dashboard-navigation';

describe('dashboard navigation', (): void => {
  it('links only to implemented dashboard pages', (): void => {
    expect(
      dashboardNavigation.some((item): boolean => item.href === '/dashboard/business-intelligence'),
    ).toBe(true);
    for (const item of dashboardNavigation) {
      expect(existsSync(resolve('apps/web/app/(dashboard)', item.href.slice(1), 'page.tsx'))).toBe(
        true,
      );
    }
  });
  it('keeps the catalog section active for new and edit routes', (): void => {
    expect(
      isDashboardDestinationActive(
        '/dashboard/catalog/products/new',
        '/dashboard/catalog/products',
      ),
    ).toBe(true);
    expect(
      isDashboardDestinationActive(
        '/dashboard/catalog/categories/id/edit',
        '/dashboard/catalog/categories',
      ),
    ).toBe(true);
    expect(isDashboardDestinationActive('/dashboard/catalog/products', '/dashboard')).toBe(false);
    expect(isDashboardDestinationActive('/dashboard/orders-other', '/dashboard/orders')).toBe(
      false,
    );
  });
  it('puts daily work first and keeps the personal profile in the account menu', (): void => {
    const all = groupDashboardNavigation(dashboardNavigation.map((item): string => item.key));
    expect(
      all.map((group): [string, string[]] => [
        group.key,
        group.items.map((item): string => item.key),
      ]),
    ).toEqual([
      ['operation', ['overview', 'orders']],
      ['catalog', ['products', 'categories']],
      ['business', ['businessIntelligence', 'store', 'integrations', 'users']],
    ]);
    expect(
      groupDashboardNavigation(['overview', 'profile']).map((group): string => group.key),
    ).toEqual(['operation']);
  });
});
