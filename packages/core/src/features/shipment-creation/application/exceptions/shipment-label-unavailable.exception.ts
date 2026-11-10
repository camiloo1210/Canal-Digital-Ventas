import { ApplicationException } from '@/shared/application/exceptions/application.exception';

/** No downloadable label exists for this order's shipment job. */
export class ShipmentLabelUnavailableException extends ApplicationException {
  public constructor() {
    super('Shipment label is not available');
  }
}
