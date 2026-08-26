import { CartRepositoryPort } from '@/carts/application/ports/out/cart-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { ChangeCartItemQuantityDto } from '@/carts/application/dtos/change-cart-item-quantity.dto';
import { CartNotFoundException } from '@/carts/application/exceptions/cart-not-found.exception';

export class ChangeCartItemQuantityUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: ChangeCartItemQuantityDto): Promise<void> {
    const cart = await this.cartRepository.findById(dto.cartId, dto.tenantId);

    if (!cart) {
      throw new CartNotFoundException();
    }

    cart.changeItemQuantity(dto.itemId, dto.quantity);

    await this.cartRepository.save(cart);
    await this.eventBus.publish(cart.domainEvents);
    cart.clearDomainEvents();
  }
}
