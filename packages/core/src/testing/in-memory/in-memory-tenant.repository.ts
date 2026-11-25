import { Tenant, type TenantProps } from '@/tenants/domain/entities/tenant.entity';
import type { TenantId } from '@/shared/domain/types/tenant-id.type';
import type { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import type {
  TenantFilters,
  TenantRepositoryPort,
} from '@/tenants/application/ports/out/tenant-repository.port';
import type { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';

function snapshotOf(tenant: Tenant): TenantProps {
  return {
    id: tenant.getId(),
    name: tenant.getName(),
    slug: tenant.getSlug(),
    description: tenant.getDescription(),
    contactEmail: tenant.getContactEmail(),
    baseCurrency: tenant.getBaseCurrency(),
    status: tenant.getStatus(),
    taxId: tenant.getTaxId(),
    customDomain: tenant.getCustomDomain(),
    logoUrl: tenant.getLogoUrl(),
    bannerUrl: tenant.getBannerUrl(),
    createdAt: new Date(tenant.getCreatedAt()),
    updatedAt: new Date(tenant.getUpdatedAt()),
    version: tenant.getVersion(),
  };
}

function paginate<T>(items: T[], pagination?: PaginationOptions): PaginatedResult<T> {
  if (!pagination) {
    return { items, totalItems: items.length, totalPages: 1, currentPage: 1 };
  }
  const start = (pagination.page - 1) * pagination.limit;
  return {
    items: items.slice(start, start + pagination.limit),
    totalItems: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / pagination.limit)),
    currentPage: pagination.page,
  };
}

/**
 * In-memory tenant repository. The tenant id is the aggregate and the isolation boundary, so
 * there is no extra tenant scope. Stores snapshots: reads return fresh instances without events.
 */
export class InMemoryTenantRepository implements TenantRepositoryPort {
  private readonly store = new Map<string, TenantProps>();
  public saveCount = 0;
  public updateCount = 0;
  public onboardCount = 0;
  public deleteCount = 0;

  /** Test setup helper: stores a snapshot without counting as a write. */
  public seed(...tenants: Tenant[]): void {
    for (const tenant of tenants) {
      this.store.set(tenant.getId(), snapshotOf(tenant));
    }
  }

  private all(): Tenant[] {
    return [...this.store.values()].map((props): Tenant => Tenant.reconstitute(props));
  }

  async save(tenant: Tenant): Promise<void> {
    this.saveCount++;
    this.seed(tenant);
  }

  async onboard(tenant: Tenant): Promise<void> {
    this.onboardCount++;
    this.seed(tenant);
  }

  async update(tenant: Tenant): Promise<void> {
    this.updateCount++;
    this.seed(tenant);
  }

  async delete(tenantId: TenantId): Promise<void> {
    this.deleteCount++;
    this.store.delete(tenantId);
  }

  async findById(id: TenantId): Promise<Tenant | null> {
    const props = this.store.get(id);
    return props ? Tenant.reconstitute(props) : null;
  }

  async findBySlug(slug: TenantSlug): Promise<Tenant | null> {
    return (
      this.all().find((tenant): boolean => tenant.getSlug().getValue() === slug.getValue()) ?? null
    );
  }

  async findAll(
    filters: TenantFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Tenant>> {
    return this.searchByFilters(filters, pagination);
  }

  async searchByFilters(
    filters: TenantFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Tenant>> {
    const matches = this.all().filter(
      (tenant): boolean =>
        (filters.id === undefined || tenant.getId() === filters.id) &&
        (filters.slug === undefined || tenant.getSlug().getValue() === filters.slug.getValue()) &&
        (filters.status === undefined || filters.status.includes(tenant.getStatus())) &&
        (filters.name === undefined ||
          tenant
            .getName()
            .getValue()
            .toLowerCase()
            .includes(filters.name.getValue().toLowerCase())),
    );
    return paginate(matches, pagination);
  }
}
