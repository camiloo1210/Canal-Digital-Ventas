import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

/** The carrier definitely refused the shipment; `code` is a sanitized, non-sensitive reason. */
export class ShipmentProviderRejectedException extends InfrastructureException {
  public constructor(public readonly code: string) {
    super('Carrier rejected the shipment request');
    this.name = 'ShipmentProviderRejectedException';
  }
}
