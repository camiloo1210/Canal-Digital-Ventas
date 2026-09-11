import { ChangeUserRoleDto } from '@/iam/application/dtos/change-user-role.dto';
import { UserRepositoryPort } from '@/iam/application/ports/out/user-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { createUserId } from '@/iam/domain/types/user-id.type';
import { UserRole } from '@/iam/domain/enums/role.enum';
import { InvalidRoleException } from '@/iam/domain/exceptions/invalid-role.exception';
import { UserNotFoundException } from '@/iam/application/exceptions/user-not-found.exception';

function parseRole(role: string): UserRole {
  if (!Object.values(UserRole).includes(role as UserRole)) {
    throw new InvalidRoleException(role);
  }
  return role as UserRole;
}

export class ChangeUserRoleUseCase {
  constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: ChangeUserRoleDto): Promise<void> {
    const userId = createUserId(dto.userId);
    const newRole = parseRole(dto.newRole);

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException(dto.userId);
    }

    user.changeRole(newRole);

    await this.userRepository.save(user);

    // Dispatch events
    await this.eventBus.publish(user.domainEvents);
    user.clearDomainEvents();
  }
}
