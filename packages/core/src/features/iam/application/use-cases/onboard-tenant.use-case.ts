import { TenantRepositoryPort } from '@/tenants/application/ports/out/tenant-repository.port';
import { AdminAuthPort } from '@/iam/application/ports/out/admin-auth.port';
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
    private readonly adminAuth: AdminAuthPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: OnboardTenantDto, currentUserId: string): Promise<void> {
    const tenantId = createTenantId(dto.tenantId);

    // 1. Create and save Tenant
    const tenant = Tenant.create(
      tenantId,
      TenantName.create(dto.name),
      TenantSlug.create(dto.slug),
      Email.create(dto.contactEmail),
      (dto.baseCurrency as Currency) || Currency.USD,
    );
    await this.tenantRepository.save(tenant);

    // 2. Create and save User (Owner)
    const owner = User.createOwner(
      createUserId(currentUserId),
      tenantId,
      Email.create(dto.userEmail),
      PersonName.create(dto.firstName),
      PersonName.create(dto.lastName),
    );
    await this.userRepository.save(owner);

    // 3. Securely update the user's JWT claims via the Admin Port
    await this.adminAuth.setTenantClaim(currentUserId, tenant.getId());

    // 4. Publish Domain Events
    const events = [...tenant.domainEvents, ...owner.domainEvents];
    await this.eventBus.publish(events);

    // 5. Clear events
    tenant.clearDomainEvents();
    owner.clearDomainEvents();
  }
}
