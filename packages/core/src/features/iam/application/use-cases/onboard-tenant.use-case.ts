import { TenantRepositoryPort } from '@/tenants/application/ports/out/tenant-repository.port';

import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { UserRepositoryPort } from '@/iam/application/ports/out/user-repository.port';
import { Tenant } from '@/tenants/domain/entities/tenant.entity';
import { User } from '@/iam/domain/entities/user.entity';
import { TenantName } from '@/tenants/domain/value-objects/tenant-name.vo';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { PersonName } from '@/shared/domain/value-objects/person-name.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createUserId } from '@/iam/domain/types/user-id.type';
import { OnboardTenantDto } from '@/iam/application/dtos/onboard-tenant.dto';

export class OnboardTenantUseCase {
  constructor(
    private readonly tenantRepository: TenantRepositoryPort,
    private readonly userRepository: UserRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(
    dto: OnboardTenantDto,
    currentUserId: string,
    idempotencyKey: string,
  ): Promise<void> {
    // 1. Create and assemble Tenant
    const tenantId = createTenantId(dto.tenantId);
    const tenant = Tenant.create(
      tenantId,
      TenantName.create(dto.name),
      TenantSlug.create(dto.slug),
      Email.create(dto.contactEmail),
      (dto.baseCurrency as Currency) || Currency.USD,
    );

    // Since onboarding is a single step right now, we activate the tenant immediately
    tenant.activate();

    // 2. Create Owner entity (for domain events and validation)
    const owner = User.createOwner(
      createUserId(currentUserId),
      tenantId,
      Email.create(dto.userEmail),
      PersonName.create(dto.firstName),
      PersonName.create(dto.lastName),
    );

    // 3. Execute Atomic RPC Onboarding
    await this.tenantRepository.onboard(
      tenant,
      currentUserId,
      {
        email: dto.userEmail,
        first_name: dto.firstName,
        last_name: dto.lastName,
      },
      idempotencyKey,
    );

    // 4. Publish Domain Events
    const events = [...tenant.domainEvents, ...owner.domainEvents];
    await this.eventBus.publish(events);

    // 5. Clear events
    tenant.clearDomainEvents();
    owner.clearDomainEvents();
  }
}
