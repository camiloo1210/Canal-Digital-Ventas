import { UpdateUserPermissionsDto } from '@/iam/application/dtos/update-user-permissions.dto';
import { UserRepositoryPort } from '@/iam/application/ports/out/user-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { createUserId } from '@/iam/domain/types/user-id.type';
import { UserPermission } from '@/iam/domain/enums/permission.enum';
import { UserNotFoundException } from '@/iam/application/exceptions/user-not-found.exception';
import { InvalidPermissionException } from '@/iam/domain/exceptions/invalid-permission.exception';

function parsePermissions(permissions: string[]): UserPermission[] {
  const validPermissions = Object.values(UserPermission);
  return permissions.map((p) => {
    if (!validPermissions.includes(p as UserPermission)) {
      throw new InvalidPermissionException(p);
    }
    return p as UserPermission;
  });
}

export class UpdateUserPermissionsUseCase {
  constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: UpdateUserPermissionsDto): Promise<void> {
    const userId = createUserId(dto.userId);
    const permissions = parsePermissions(dto.permissions);

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException(dto.userId);
    }

    // We overwrite the discrete array entirely, so we revoke all existing then grant new.
    // Or we can just calculate the difference.
    // A simpler approach for the aggregate is to revoke all, then grant new,
    // or provide an explicit setter if it fits better.
    // Since we created grantPermissions and revokePermissions, let's use them.
    const currentPermissions = user.getPermissions();

    // Revoke permissions that are in current but not in new
    const toRevoke = currentPermissions.filter((p) => !permissions.includes(p));
    if (toRevoke.length > 0) {
      user.revokePermissions(toRevoke);
    }

    // Grant permissions that are in new but not in current
    const toGrant = permissions.filter((p) => !currentPermissions.includes(p));
    if (toGrant.length > 0) {
      user.grantPermissions(toGrant);
    }

    await this.userRepository.save(user);

    await this.eventBus.publish(user.domainEvents);
    user.clearDomainEvents();
  }
}
