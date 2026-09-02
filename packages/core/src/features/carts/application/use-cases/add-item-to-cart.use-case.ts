import { CartRepositoryPort } from '@/carts/application/ports/out/cart-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { AddItemToCartDto } from '@/carts/application/dtos/add-item-to-cart.dto';
import { CartItem } from '@/carts/domain/entities/cart-item.entity';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { createCartItemId } from '@/carts/domain/types/cart-item-id.type';
import { CartNotFoundException } from '@/carts/application/exceptions/cart-not-found.exception';
import { createCartId } from '@/carts/domain/types/cart-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createProductId } from '@/carts/domain/types/product-id.type';
import { createVariantId } from '@/carts/domain/types/variant-id.type';
import * as crypto from 'crypto';

export class AddItemToCartUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: AddItemToCartDto): Promise<void> {
    const cartId = createCartId(dto.cartId);
    const tenantId = createTenantId(dto.tenantId);

    const cart = await this.cartRepository.findById(cartId, tenantId);

    if (!cart) {
      throw new CartNotFoundException();
    }

    const unitPrice = Money.from(dto.unitPriceValue, Currency.USD);
    const cartItemId = createCartItemId(crypto.randomUUID());
    const productId = createProductId(dto.productId);
    const variantId = dto.variantId ? createVariantId(dto.variantId) : undefined;

    const item = CartItem.create(
      cartItemId,
      productId,
      dto.productName,
      dto.quantity,
      unitPrice,
      dto.sku,
      variantId,
    );

    cart.addItem(item);

    await this.cartRepository.save(cart);
    await this.eventBus.publish(cart.domainEvents);
    cart.clearDomainEvents();
  }
}
