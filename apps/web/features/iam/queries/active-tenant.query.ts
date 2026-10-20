import 'server-only';
import { cache } from 'react';
import {
  createTenantId,
  type ActiveTenantContextReadModel,
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

export async function getActiveTenantQuery(userId: string): Promise<TenantId | null> {
  const context = await getActiveTenantContextQuery(userId);
  return context.status === 'ready' ? createTenantId(context.tenantId) : null;
}
