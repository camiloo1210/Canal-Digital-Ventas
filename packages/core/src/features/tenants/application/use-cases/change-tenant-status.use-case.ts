import { TenantRepositoryPort } from '@/tenants/application/ports/out/tenant-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { ChangeTenantStatusDto } from '@/tenants/application/dtos/change-tenant-status.dto';
import { TenantNotFoundException } from '@/tenants/application/exceptions/tenant-not-found.exception';
import { UnsupportedTenantStatusException } from '@/tenants/application/exceptions/unsupported-tenant-status.exception';
import { TenantStatus } from '@/tenants/domain/enums/tenant-status.enum';

export class ChangeTenantStatusUseCase {
  constructor(
    private readonly tenantRepository: TenantRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: ChangeTenantStatusDto): Promise<void> {
    const tenant = await this.tenantRepository.findById(dto.tenantId);
    if (!tenant) {
      throw new TenantNotFoundException();
    }

    switch (dto.status) {
      case TenantStatus.ACTIVE:
        tenant.activate();
        break;
      case TenantStatus.SUSPENDED:
        tenant.suspend(dto.reason || 'Suspended by admin request');
        break;
      case TenantStatus.ARCHIVED:
        tenant.archive();
        break;
      default:
        throw new UnsupportedTenantStatusException(dto.status);
    }

    await this.tenantRepository.update(tenant);
    await this.eventBus.publish(tenant.domainEvents);
    tenant.clearDomainEvents();
  }
}
