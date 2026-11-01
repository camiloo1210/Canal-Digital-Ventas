import 'server-only';

import { getActiveTenantContextQuery } from '@/features/iam/queries/active-tenant.query';
import { invalidatePublicCatalog } from '@/lib/cache/public-catalog-cache';

export async function invalidateActiveTenantCatalog(userId: string): Promise<void> {
  try {
    const context = await getActiveTenantContextQuery(userId);
    if (context.status === 'ready') await invalidatePublicCatalog(context.tenantSlug);
  } catch {
    // Invalidation is best-effort; entries still expire by TTL.
  }
}
