import { SuspendUserDto } from '@/iam/application/dtos/suspend-user.dto';
import { UserRepositoryPort } from '@/iam/application/ports/out/user-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { createUserId } from '@/iam/domain/types/user-id.type';
import { UserNotFoundException } from '@/iam/application/exceptions/user-not-found.exception';

export class SuspendUserUseCase {
  constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: SuspendUserDto): Promise<void> {
    const userId = createUserId(dto.userId);

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException(dto.userId);
    }

    user.suspend();

    await this.userRepository.save(user);

    // Dispatch events
    await this.eventBus.publish(user.domainEvents);
    user.clearDomainEvents();
  }
}
