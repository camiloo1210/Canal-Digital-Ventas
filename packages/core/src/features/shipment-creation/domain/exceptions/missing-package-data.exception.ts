import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class MissingPackageDataException extends DomainException {
  constructor() {
    super('Shipment requires at least one item with complete package data.');
  }
}
