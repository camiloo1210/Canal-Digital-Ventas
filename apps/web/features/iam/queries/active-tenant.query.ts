import { createClient } from '@/lib/supabase/server';
import {
  createTenantId,
  TenantId,
} from '@canaldigital/packages/core/src/features/shared/domain/types/tenant-id.type';

/**
 * Resolves the active UI context (Tenant) for the current user.
 *
 * IMPORTANT: This query strictly resolves the frontend view context.
 * It does NOT constitute security authorization. Actual data isolation and
 * authorization is strictly enforced at the database level by PostgreSQL RLS
 * and `core.user_has_access_to_tenant()` against the user's `auth.uid()`.
 *
 * CURRENT MVP SCOPE: Assumes the user has a single active tenant membership.
 * If multiple memberships are supported in the future, this query must accept
 * an explicit `activeTenantId` from the request context (e.g. cookie/url)
 * and validate the membership against it.
 */
export async function getActiveTenantQuery(userId: string): Promise<TenantId | null> {
  const supabase = await createClient();

  // Read-only query to infrastructure, safe because SSR client acts on behalf of auth.uid()
  const { data, error } = await supabase
    .schema('core')
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    console.error('[ActiveTenantQuery] Failed determining tenant context:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  // MVP constraint: If the user has exactly 1 active membership, we proceed.
  // We do NOT use limit(1) to arbitrarily pick a tenant if they had multiple.
  if (data.length > 1) {
    console.error(
      '[ActiveTenantQuery] User has multiple active tenants. Multi-tenant context switcher not implemented.',
    );
    return null; // Force them out or into a context selection screen (not implemented yet)
  }

  return createTenantId(data[0].tenant_id);
}
