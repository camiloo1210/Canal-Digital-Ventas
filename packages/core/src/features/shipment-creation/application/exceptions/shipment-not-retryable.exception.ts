import { ApplicationException } from '@/shared/application/exceptions/application.exception';

/** The shipment job is not in a state the seller may retry from (or the actor may not retry). */
export class ShipmentNotRetryableException extends ApplicationException {
  public constructor() {
    super('Shipment creation cannot be retried in its current state');
  }
}
