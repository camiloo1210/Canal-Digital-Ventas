import 'server-only';
import { resolveActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import { isTenantId, TENANT_FIELD } from '@/features/dashboard/utils/tenant-scope';

export interface ActionTenant {
  tenantId: string;
  tenantSlug: string;
  role: string;
}

/**
 * The business a mutation is meant for: the hidden `tenantId` field (or, for programmatic calls, the explicit id argument) rendered by the page, accepted
 * only when it is a uuid and the signed-in user holds an ACTIVE membership in exactly that tenant.
 * The `active_tenant` cookie is never consulted here, so two tabs on two businesses cannot cross.
 * Returns null for absent, malformed or foreign ids; callers answer with the "context changed" error.
 */
export async function resolveActionTenant(
  source: FormData | string | null | undefined,
  userId: string,
): Promise<ActionTenant | null> {
  const submitted = source instanceof FormData ? source.get(TENANT_FIELD) : source;
  if (!isTenantId(submitted)) return null;
  const context = await resolveActiveTenantQuery(userId, submitted);
  if (!context) return null;
  return { tenantId: context.tenantId, tenantSlug: context.tenantSlug, role: context.role };
}
