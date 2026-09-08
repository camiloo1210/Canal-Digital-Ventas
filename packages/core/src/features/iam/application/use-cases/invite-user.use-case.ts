import { InviteUserDto } from '@/iam/application/dtos/invite-user.dto';
import { UserRepositoryPort } from '@/iam/application/ports/out/user-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { User } from '@/iam/domain/entities/user.entity';
import { createUserId } from '@/iam/domain/types/user-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { UserRole } from '@/iam/domain/enums/role.enum';
import { InvalidRoleException } from '@/iam/domain/exceptions/invalid-role.exception';

function parseRole(role: string): UserRole {
  if (!Object.values(UserRole).includes(role as UserRole)) {
    throw new InvalidRoleException(role);
  }
  return role as UserRole;
}

export class InviteUserUseCase {
  constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: InviteUserDto): Promise<void> {
    const userId = createUserId(dto.userId);
    const tenantId = dto.tenantId as TenantId;
    const emailVO = Email.create(dto.email);
    const role = parseRole(dto.role);

    const user = User.invite(userId, tenantId, emailVO, role);

    await this.userRepository.save(user);

    // Dispatch events
    await this.eventBus.publish(user.domainEvents);
    user.clearDomainEvents();
  }
}
