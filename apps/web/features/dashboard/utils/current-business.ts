import { isTenantId, tenantParam } from '@/features/dashboard/utils/tenant-scope';

export interface BusinessOption {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  logoUrl: string | null;
  role: string;
  /** Navigation destinations this member may see in that business. */
  visibleKeys: string[];
}

/**
 * Business the shell displays: the explicit `?tenant=` value when it is one of the user's
 * businesses, else the only business, else the cookie default. Display only; the server
 * re-validates on every request and mutation.
 */
export function currentBusiness(
  businesses: readonly BusinessOption[],
  tenantParamValue: string | null,
  defaultTenantId: string | null,
): BusinessOption | null {
  const requestedTenant = tenantParam(tenantParamValue);
  if (requestedTenant) {
    // An explicit value is never second-guessed: unknown or malformed means "no business".
    if (!isTenantId(requestedTenant)) return null;
    return businesses.find((business): boolean => business.tenantId === requestedTenant) ?? null;
  }
  if (businesses.length === 1) return businesses[0] ?? null;
  return businesses.find((business): boolean => business.tenantId === defaultTenantId) ?? null;
}
