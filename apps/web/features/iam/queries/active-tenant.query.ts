import 'server-only';
import { cache } from 'react';
import {
  createTenantId,
  type ActiveMembershipSummary,
  type ActiveTenantContextReadModel,
  type ActiveTenantReadyContext,
  type TenantId,
} from '@canaldigital/packages/core';
import { getActiveTenantContextReadRepository } from '@/features/iam/di/iam.di';

/** Request-scoped projection; mutation authorization remains in Core and RLS. */
export const getActiveTenantContextQuery = cache(
  async (userId: string): Promise<ActiveTenantContextReadModel> => {
    const repository = await getActiveTenantContextReadRepository();
    return repository.findForUser(userId);
  },
);

/** Every ACTIVE membership of the user (used by the switcher and the selector page). */
export const getActiveMembershipsQuery = cache(
  async (userId: string): Promise<ActiveMembershipSummary[]> => {
    const repository = await getActiveTenantContextReadRepository();
    return repository.findAllActiveForUser(userId);
  },
);

/** Ready context of exactly this tenant when the user is an ACTIVE member of it; otherwise null. */
export async function resolveActiveTenantQuery(
  userId: string,
  tenantId: string,
): Promise<ActiveTenantReadyContext | null> {
  const repository = await getActiveTenantContextReadRepository();
  return repository.resolveForUser(userId, tenantId);
}

/**
 * Tenant of a user with exactly one active membership. Users managing several businesses must
 * name the business explicitly (see resolveActiveTenantQuery); this never picks one for them.
 */
export async function getActiveTenantQuery(userId: string): Promise<TenantId | null> {
  const context = await getActiveTenantContextQuery(userId);
  return context.status === 'ready' ? createTenantId(context.tenantId) : null;
}
