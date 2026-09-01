import { Tenant } from '@/tenants/domain/entities/tenant.entity';
import { TenantName } from '@/tenants/domain/value-objects/tenant-name.vo';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { TenantRepositoryPort } from '@/tenants/application/ports/out/tenant-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { CreateTenantDto } from '@/tenants/application/dtos/create-tenant.dto';
import { TenantSlugAlreadyInUseException } from '@/tenants/application/exceptions/tenant-slug-already-in-use.exception';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { parseCurrency } from '@/shared/domain/enums/currency.enum';

export class CreateTenantUseCase {
  constructor(
    private readonly tenantRepository: TenantRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: CreateTenantDto): Promise<void> {
    const tenantId = createTenantId(dto.id);
    const name = TenantName.create(dto.name);
    const slug = TenantSlug.create(dto.slug);
    const contactEmail = Email.create(dto.contactEmail);
    const currency = parseCurrency(dto.baseCurrency);

    const existingTenant = await this.tenantRepository.findBySlug(slug);
    if (existingTenant) {
      throw new TenantSlugAlreadyInUseException();
    }

    const tenant = Tenant.create(
      tenantId,
      name,
      slug,
      contactEmail,
      currency,
      dto.taxId || null,
      dto.customDomain || null,
      dto.logoUrl || null,
    );

    await this.tenantRepository.save(tenant);
    await this.eventBus.publish(tenant.domainEvents);
    tenant.clearDomainEvents();
  }
}
