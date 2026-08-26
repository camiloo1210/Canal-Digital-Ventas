import { CartRepositoryPort } from '@/carts/application/ports/out/cart-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { RemoveItemFromCartDto } from '@/carts/application/dtos/remove-item-from-cart.dto';
import { CartNotFoundException } from '@/carts/application/exceptions/cart-not-found.exception';

export class RemoveItemFromCartUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: RemoveItemFromCartDto): Promise<void> {
    const cart = await this.cartRepository.findById(dto.cartId, dto.tenantId);

    if (!cart) {
      throw new CartNotFoundException();
    }

    cart.removeItem(dto.itemId);

    await this.cartRepository.save(cart);
    await this.eventBus.publish(cart.domainEvents);
    cart.clearDomainEvents();
  }
}
