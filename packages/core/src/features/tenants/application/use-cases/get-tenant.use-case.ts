import { TenantRepositoryPort } from '@/tenants/application/ports/out/tenant-repository.port';
import { TenantNotFoundException } from '@/tenants/application/exceptions/tenant-not-found.exception';
import { TenantId } from '@/tenants/domain/types/tenant-id.type';
import { Tenant } from '@/tenants/domain/entities/tenant.entity';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';

export class GetTenantUseCase {
  constructor(private readonly tenantRepository: TenantRepositoryPort) {}

  async executeById(id: TenantId): Promise<Tenant> {
    const tenant = await this.tenantRepository.findById(id);
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
