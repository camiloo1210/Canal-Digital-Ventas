import type { Tenant } from '@/tenants/domain/entities/tenant.entity';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type { TenantBrandingReadModel } from '@/tenants/application/read-models/tenant-branding.read-model';

export interface TenantBrandingReadRepositoryPort {
  findForManager(userId: string, tenantId: string): Promise<TenantBrandingReadModel | null>;
}

export interface TenantBrandingRepositoryPort {
  findForManager(userId: string, tenantId: string, tx: TransactionContext): Promise<Tenant | null>;
  isSlugInUse(slug: string, excludingTenantId: string, tx: TransactionContext): Promise<boolean>;
  update(tenant: Tenant, expectedVersion: number, tx: TransactionContext): Promise<void>;
}
