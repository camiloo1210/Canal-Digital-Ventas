import { CartRepositoryPort } from '@/carts/application/ports/out/cart-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { CreateCartDto } from '@/carts/application/dtos/create-cart.dto';
import { Cart } from '@/carts/domain/entities/cart.entity';
import { createCartId } from '@/carts/domain/types/cart-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createCustomerId } from '@/carts/domain/types/customer-id.type';

export class CreateCartUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: CreateCartDto): Promise<void> {
    const cartId = createCartId(dto.id);
    const tenantId = createTenantId(dto.tenantId);
    const customerId = dto.customerId ? createCustomerId(dto.customerId) : null;

    const expiresAtDate = new Date(dto.expiresAt);
    const cart = Cart.create(cartId, tenantId, customerId, expiresAtDate);

    await this.cartRepository.save(cart);
    await this.eventBus.publish(cart.domainEvents);
    cart.clearDomainEvents();
  }
}
