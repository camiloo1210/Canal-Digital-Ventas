import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidShipmentQuantityException extends DomainException {
  constructor(quantity: number) {
    super(`Shipment item quantity must be a positive safe integer, received ${quantity}.`);
  }
}
