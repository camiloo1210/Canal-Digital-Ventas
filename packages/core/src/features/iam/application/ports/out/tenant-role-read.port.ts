import type { TenantRoleReadModel } from '@/iam/application/read-models/user-management.read-models';

export interface TenantRoleReadPort {
  /** Owner-only; returns [] when the actor is not an active owner of the tenant. */
  listForOwner(userId: string, tenantId: string): Promise<TenantRoleReadModel[]>;
}
