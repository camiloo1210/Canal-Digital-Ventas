import { InvalidOrderAttributeException } from '@/orders/domain/exceptions/invalid-order-attribute.exception';

export class ManualShipmentDetails {
  private constructor(
    private readonly carrier: string | null,
    private readonly trackingNumber: string | null,
  ) {}

  public static create(
    carrier: string | null,
    trackingNumber: string | null,
  ): ManualShipmentDetails {
    const normalize = (value: string | null): string | null => {
      if (value === null) return null;
      if (
        Array.from(value).some((character): boolean => {
          const code = character.codePointAt(0) ?? 0;
          return code < 32 || code === 127;
        })
      )
        throw new InvalidOrderAttributeException('Shipment details contain control characters.');
      const normalized = value.trim();
      if (normalized.length > 120)
        throw new InvalidOrderAttributeException('Shipment details exceed the maximum length.');
      return normalized || null;
    };
    const normalizedCarrier = normalize(carrier);
    const normalizedTrackingNumber = normalize(trackingNumber);
    if (!normalizedCarrier && !normalizedTrackingNumber)
      throw new InvalidOrderAttributeException('At least one shipment detail is required.');
    return new ManualShipmentDetails(normalizedCarrier, normalizedTrackingNumber);
  }

  public getCarrier(): string | null {
    return this.carrier;
  }
  public getTrackingNumber(): string | null {
    return this.trackingNumber;
  }
}
