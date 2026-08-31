import { CartRepositoryPort } from '@/carts/application/ports/out/cart-repository.port';
import { GetCartDto } from '@/carts/application/dtos/get-cart.dto';
import { Cart } from '@/carts/domain/entities/cart.entity';
import { CartNotFoundException } from '@/carts/application/exceptions/cart-not-found.exception';
import { createCartId } from '@/carts/domain/types/cart-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class GetCartUseCase {
  constructor(private readonly cartRepository: CartRepositoryPort) {}

  async execute(dto: GetCartDto): Promise<Cart> {
    const cartId = createCartId(dto.cartId);
    const tenantId = createTenantId(dto.tenantId);

    const cart = await this.cartRepository.findById(cartId, tenantId);

    if (!cart) {
      throw new CartNotFoundException();
    }

    return cart;
  }
}
