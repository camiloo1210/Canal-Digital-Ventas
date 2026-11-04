import { describe, expect, it } from 'vitest';
import { isTenantId, tenantParam, withTenant } from '@/features/dashboard/utils/tenant-scope';

const id = '3f2b8c1e-9a4d-4e2b-8c7a-1d2e3f4a5b6c';

describe('tenant scope helpers', (): void => {
  it('accepts only uuids', (): void => {
    expect(isTenantId(id)).toBe(true);
    expect(isTenantId('tenant')).toBe(false);
    expect(isTenantId(undefined)).toBe(false);
    expect(isTenantId(null)).toBe(false);
  });
  it('reads the first search param value', (): void => {
    expect(tenantParam(id)).toBe(id);
    expect(tenantParam([id, 'x'])).toBe(id);
    expect(tenantParam('  ')).toBeNull();
    expect(tenantParam(undefined)).toBeNull();
  });
  it('appends the tenant to internal hrefs without duplicating it', (): void => {
    expect(withTenant('/dashboard', id)).toBe('/dashboard?tenant=' + id);
    expect(withTenant('/dashboard/orders?page=2', id)).toBe(
      '/dashboard/orders?page=2&tenant=' + id,
    );
    expect(withTenant('/dashboard?tenant=old&x=1', id)).toBe('/dashboard?x=1&tenant=' + id);
    expect(withTenant('/dashboard', null)).toBe('/dashboard');
  });
});
