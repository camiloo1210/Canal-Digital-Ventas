import 'server-only';

import { invalidatePublicCatalog } from '@/lib/cache/public-catalog-cache';

/** Drops the public catalog cache of the business the mutation acted on (never inferred from the user). */
export async function invalidateTenantCatalog(tenantSlug: string): Promise<void> {
  try {
    await invalidatePublicCatalog(tenantSlug);
  } catch {
    // Invalidation is best-effort; entries still expire by TTL.
  }
}
