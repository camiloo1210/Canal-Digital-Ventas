import { CartRepositoryPort } from '@/carts/application/ports/out/cart-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { AddItemToCartDto } from '@/carts/application/dtos/add-item-to-cart.dto';
import { CartItem } from '@/carts/domain/entities/cart-item.entity';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { CartItemId } from '@/carts/domain/types/cart-item-id.type';
import { CartNotFoundException } from '@/carts/application/exceptions/cart-not-found.exception';

export class AddItemToCartUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: AddItemToCartDto): Promise<void> {
    const cart = await this.cartRepository.findById(dto.cartId, dto.tenantId);

    if (!cart) {
      throw new CartNotFoundException();
    }

    const unitPrice = Money.from(dto.unitPriceValue, 'USD');
    const cartItemId = crypto.randomUUID() as CartItemId;

    const item = CartItem.create(
      cartItemId,
      dto.productId,
      dto.productName,
      dto.quantity,
      unitPrice,
      dto.sku,
      dto.variantId,
    );

    cart.addItem(item);

    await this.cartRepository.save(cart);
    await this.eventBus.publish(cart.domainEvents);
    cart.clearDomainEvents();
  }
}
