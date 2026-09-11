import { UpdateUserProfileDto } from '@/iam/application/dtos/update-user-profile.dto';
import { UserRepositoryPort } from '@/iam/application/ports/out/user-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { createUserId } from '@/iam/domain/types/user-id.type';
import { PersonName } from '@/shared/domain/value-objects/person-name.vo';
import { UserNotFoundException } from '@/iam/application/exceptions/user-not-found.exception';

export class UpdateUserProfileUseCase {
  constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: UpdateUserProfileDto): Promise<void> {
    const userId = createUserId(dto.userId);

    // VO Parsing prevents Primitive Obsession
    const firstName = PersonName.create(dto.firstName);
    const lastName = PersonName.create(dto.lastName);

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException(dto.userId);
    }

    user.updateProfile(firstName, lastName);

    await this.userRepository.save(user);

    await this.eventBus.publish(user.domainEvents);
    user.clearDomainEvents();
  }
}
