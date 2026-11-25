import 'server-only';
import { UserPermission } from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { resolveActionTenant } from '@/features/dashboard/server/resolve-action-tenant';
import { userHasAnyPermission } from '@/features/users/queries/member-permissions.query';

export type OrderManagerResolution =
  | { readonly ok: true; readonly userId: string; readonly tenantId: string }
  | { readonly ok: false; readonly reason: 'unauthorized' | 'contextChanged' };

/**
 * Server-side actor and tenant for an order mutation: the authenticated user, a tenant the user
 * actively belongs to, and MANAGE_ORDERS there. Client-submitted actor ids are never read.
 */
export async function resolveOrderManager(formData: FormData): Promise<OrderManagerResolution> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, reason: 'unauthorized' };
  const tenant = await resolveActionTenant(formData, user.id);
  if (!tenant) return { ok: false, reason: 'contextChanged' };
  if (!(await userHasAnyPermission(user.id, tenant.tenantId, [UserPermission.MANAGE_ORDERS])))
    return { ok: false, reason: 'unauthorized' };
  return { ok: true, userId: user.id, tenantId: tenant.tenantId };
}
