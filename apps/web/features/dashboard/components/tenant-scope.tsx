'use client';

import { createContext, useContext } from 'react';
import Link from 'next/link';
import { TENANT_FIELD, TENANT_PARAM, withTenant } from '@/features/dashboard/utils/tenant-scope';

const TenantScopeContext = createContext<string>('');

/**
 * Names the business a dashboard page renders. Every form below reads it through
 * <TenantIdField /> so each mutation carries the business explicitly; the server action
 * re-validates it against the user's ACTIVE memberships and never trusts it.
 */
export function TenantScope({
  tenantId,
  children,
}: {
  tenantId: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return <TenantScopeContext.Provider value={tenantId}>{children}</TenantScopeContext.Provider>;
}

/** Business of the surrounding page; empty (fails closed on the server) outside a <TenantScope>. */
export function useTenantId(): string {
  return useContext(TenantScopeContext);
}

export function TenantIdField(): React.JSX.Element {
  return <input type="hidden" name={TENANT_FIELD} value={useTenantId()} />;
}

/** Hidden `tenant` search param for GET forms (search, filters) so a submitted query keeps its business. */
export function TenantParamField(): React.JSX.Element | null {
  const tenantId = useTenantId();
  return tenantId ? <input type="hidden" name={TENANT_PARAM} value={tenantId} /> : null;
}

/** Internal dashboard link that carries the page's business as `?tenant=`. */
export function TenantLink({
  href,
  ...props
}: React.ComponentProps<typeof Link>): React.JSX.Element {
  const tenantId = useTenantId();
  return <Link {...props} href={typeof href === 'string' ? withTenant(href, tenantId) : href} />;
}
