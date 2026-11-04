import { describe, expect, it } from 'vitest';
import { currentBusiness, type BusinessOption } from '@/features/dashboard/utils/current-business';

const A = '3f2b8c1e-9a4d-4e2b-8c7a-1d2e3f4a5b6c';
const B = '7a1d5e2f-0b3c-4d6e-9f81-2a3b4c5d6e7f';
const make = (tenantId: string): BusinessOption => ({
  tenantId,
  tenantName: tenantId,
  tenantSlug: tenantId,
  role: 'OWNER',
  visibleKeys: [],
});

describe('currentBusiness', (): void => {
  it('prefers the explicit param over the default', (): void => {
    expect(currentBusiness([make(A), make(B)], B, A)?.tenantId).toBe(B);
  });
  it('uses the default when no param is present', (): void => {
    expect(currentBusiness([make(A), make(B)], null, A)?.tenantId).toBe(A);
  });
  it('returns null when several businesses exist and nothing valid is chosen', (): void => {
    expect(currentBusiness([make(A), make(B)], null, null)).toBeNull();
    expect(currentBusiness([make(A), make(B)], null, 'stale')).toBeNull();
  });
  it('never shows a business the user does not have, even when it is requested', (): void => {
    expect(
      currentBusiness([make(A), make(B)], 'c0ffee00-0000-4000-8000-000000000000', A),
    ).toBeNull();
    expect(currentBusiness([make(A)], 'junk', A)).toBeNull();
  });
  it('uses the only business when there is just one', (): void => {
    expect(currentBusiness([make(A)], null, null)?.tenantId).toBe(A);
  });
});
