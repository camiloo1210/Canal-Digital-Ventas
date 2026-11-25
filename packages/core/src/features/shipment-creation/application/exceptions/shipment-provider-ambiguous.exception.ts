import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

/** The carrier outcome is unknown: a shipment may already exist, so it must never be auto-retried. */
export class ShipmentProviderAmbiguousException extends InfrastructureException {
  public constructor() {
    super('Carrier shipment outcome is unknown');
    this.name = 'ShipmentProviderAmbiguousException';
  }
}
