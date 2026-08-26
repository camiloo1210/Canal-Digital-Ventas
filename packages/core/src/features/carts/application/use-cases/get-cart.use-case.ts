import { CartRepositoryPort } from '@/carts/application/ports/out/cart-repository.port';
import { GetCartDto } from '@/carts/application/dtos/get-cart.dto';
import { Cart } from '@/carts/domain/entities/cart.entity';
import { CartNotFoundException } from '@/carts/application/exceptions/cart-not-found.exception';

export class GetCartUseCase {
  constructor(private readonly cartRepository: CartRepositoryPort) {}

  async execute(dto: GetCartDto): Promise<Cart> {
    const cart = await this.cartRepository.findById(dto.cartId, dto.tenantId);

    if (!cart) {
      throw new CartNotFoundException();
    }

    return cart;
  }
}
