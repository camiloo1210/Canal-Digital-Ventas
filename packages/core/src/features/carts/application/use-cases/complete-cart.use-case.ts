import { CartRepositoryPort } from '@/carts/application/ports/out/cart-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { CompleteCartDto } from '@/carts/application/dtos/complete-cart.dto';
import { CartNotFoundException } from '@/carts/application/exceptions/cart-not-found.exception';

export class CompleteCartUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: CompleteCartDto): Promise<void> {
    const cart = await this.cartRepository.findById(dto.cartId, dto.tenantId);

    if (!cart) {
      throw new CartNotFoundException();
    }

    cart.complete();

    await this.cartRepository.save(cart);
    await this.eventBus.publish(cart.domainEvents);
    cart.clearDomainEvents();
  }
}
