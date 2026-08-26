import { CartRepositoryPort } from '@/carts/application/ports/out/cart-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { AssignCustomerToCartDto } from '@/carts/application/dtos/assign-customer-to-cart.dto';
import { CartNotFoundException } from '@/carts/application/exceptions/cart-not-found.exception';

export class AssignCustomerToCartUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: AssignCustomerToCartDto): Promise<void> {
    const cart = await this.cartRepository.findById(dto.cartId, dto.tenantId);

    if (!cart) {
      throw new CartNotFoundException();
    }

    cart.assignCustomer(dto.customerId);

    await this.cartRepository.save(cart);
    await this.eventBus.publish(cart.domainEvents);
    cart.clearDomainEvents();
  }
}
