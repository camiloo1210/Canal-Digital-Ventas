import { ApplicationException } from '@/shared/application/exceptions/application.exception';

/** The carrier already created a shipment for this job; retrying would create a duplicate. */
export class ShipmentRetryNotAllowedException extends ApplicationException {
  public constructor() {
    super('Shipment already exists at the carrier; record its tracking number instead');
  }
}
