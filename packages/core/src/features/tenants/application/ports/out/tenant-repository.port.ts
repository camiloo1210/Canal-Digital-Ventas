import { Tenant } from '@/tenants/domain/entities/tenant.entity';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import { TenantStatus } from '@/tenants/domain/enums/tenant-status.enum';
import { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';
import { TenantName } from '@/tenants/domain/value-objects/tenant-name.vo';
export interface TenantFilters {
  id?: TenantId;
  slug?: TenantSlug;
  status?: TenantStatus[];
  name?: TenantName;
}

export interface TenantRepositoryPort {
  save(tenant: Tenant): Promise<void>;
  update(tenant: Tenant): Promise<void>;
  delete(tenantId: TenantId): Promise<void>;
  findById(id: TenantId): Promise<Tenant | null>;
  findBySlug(slug: TenantSlug): Promise<Tenant | null>;
  findAll(filters: TenantFilters, pagination?: PaginationOptions): Promise<PaginatedResult<Tenant>>;
  searchByFilters(
    filters: TenantFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Tenant>>;
}
