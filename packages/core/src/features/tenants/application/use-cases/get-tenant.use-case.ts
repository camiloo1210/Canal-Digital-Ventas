import { TenantRepositoryPort } from '@/tenants/application/ports/out/tenant-repository.port';
import { TenantNotFoundException } from '@/tenants/application/exceptions/tenant-not-found.exception';
import { Tenant } from '@/tenants/domain/entities/tenant.entity';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class GetTenantUseCase {
  constructor(private readonly tenantRepository: TenantRepositoryPort) {}

  async executeById(id: string): Promise<Tenant> {
    const tenantId = createTenantId(id);
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new TenantNotFoundException();
    }
    return tenant;
  }

  async executeBySlug(slugString: string): Promise<Tenant> {
    const slug = TenantSlug.create(slugString);
    const tenant = await this.tenantRepository.findBySlug(slug);
    if (!tenant) {
      throw new TenantNotFoundException();
    }
    return tenant;
  }
}
