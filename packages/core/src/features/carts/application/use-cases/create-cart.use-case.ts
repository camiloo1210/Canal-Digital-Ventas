import { CartRepositoryPort } from '@/carts/application/ports/out/cart-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { CreateCartDto } from '@/carts/application/dtos/create-cart.dto';
import { Cart } from '@/carts/domain/entities/cart.entity';

export class CreateCartUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: CreateCartDto): Promise<void> {
    const cart = Cart.create(dto.id, dto.tenantId, dto.customerId, dto.expiresAt);

    await this.cartRepository.save(cart);
    await this.eventBus.publish(cart.domainEvents);
    cart.clearDomainEvents();
  }
}
