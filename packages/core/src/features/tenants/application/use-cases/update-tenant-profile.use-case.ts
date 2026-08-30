import { TenantName } from '@/tenants/domain/value-objects/tenant-name.vo';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { TenantRepositoryPort } from '@/tenants/application/ports/out/tenant-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { UpdateTenantProfileDto } from '@/tenants/application/dtos/update-tenant-profile.dto';
import { TenantNotFoundException } from '@/tenants/application/exceptions/tenant-not-found.exception';
import { TenantSlugAlreadyInUseException } from '@/tenants/application/exceptions/tenant-slug-already-in-use.exception';

export class UpdateTenantProfileUseCase {
  constructor(
    private readonly tenantRepository: TenantRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: UpdateTenantProfileDto): Promise<void> {
    const tenant = await this.tenantRepository.findById(dto.tenantId);
    if (!tenant) {
      throw new TenantNotFoundException();
    }

    const name = TenantName.create(dto.name);
    const slug = TenantSlug.create(dto.slug);
    const contactEmail = Email.create(dto.contactEmail);

    if (tenant.getSlug().getValue() !== slug.getValue()) {
      const existing = await this.tenantRepository.findBySlug(slug);
      if (existing) {
        throw new TenantSlugAlreadyInUseException();
      }
    }

    tenant.updateProfile(
      name,
      slug,
      contactEmail,
      dto.taxId || null,
      dto.customDomain || null,
      dto.logoUrl || null,
    );

    await this.tenantRepository.update(tenant);
    await this.eventBus.publish(tenant.domainEvents);
    tenant.clearDomainEvents();
  }
}
