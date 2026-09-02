import { CartRepositoryPort } from '@/carts/application/ports/out/cart-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { CompleteCartDto } from '@/carts/application/dtos/complete-cart.dto';
import { CartNotFoundException } from '@/carts/application/exceptions/cart-not-found.exception';
import { createCartId } from '@/carts/domain/types/cart-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class CompleteCartUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: CompleteCartDto): Promise<void> {
    const cartId = createCartId(dto.cartId);
    const tenantId = createTenantId(dto.tenantId);

    const cart = await this.cartRepository.findById(cartId, tenantId);

    if (!cart) {
      throw new CartNotFoundException();
    }

    cart.complete();

    await this.cartRepository.save(cart);
    await this.eventBus.publish(cart.domainEvents);
    cart.clearDomainEvents();
  }
}
