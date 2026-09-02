import { TenantRepositoryPort } from '@/tenants/application/ports/out/tenant-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { ChangeTenantStatusDto } from '@/tenants/application/dtos/change-tenant-status.dto';
import { TenantNotFoundException } from '@/tenants/application/exceptions/tenant-not-found.exception';
import { UnsupportedTenantStatusException } from '@/tenants/application/exceptions/unsupported-tenant-status.exception';
import { TenantStatus, parseTenantStatus } from '@/tenants/domain/enums/tenant-status.enum';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class ChangeTenantStatusUseCase {
  constructor(
    private readonly tenantRepository: TenantRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: ChangeTenantStatusDto): Promise<void> {
    const tenantId = createTenantId(dto.tenantId);
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new TenantNotFoundException();
    }

    const status = parseTenantStatus(dto.status);

    switch (status) {
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
        throw new UnsupportedTenantStatusException(status);
    }

    await this.tenantRepository.update(tenant);
    await this.eventBus.publish(tenant.domainEvents);
    tenant.clearDomainEvents();
  }
}
