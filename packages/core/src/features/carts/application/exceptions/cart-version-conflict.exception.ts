import { ApplicationException } from '@/shared/application/exceptions/application.exception';
import type { BuyerCartReadModel } from '@/carts/application/read-models/buyer-cart.read-model';

export class CartVersionConflictException extends ApplicationException {
  constructor(public readonly serverCart: BuyerCartReadModel) {
    super('The server cart changed since the supplied base version.');
  }
}
