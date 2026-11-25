import { describe, expect, it } from 'vitest';
import { ManualShipmentDetails } from '@/orders/domain/value-objects/manual-shipment-details.vo';
import { InvalidOrderAttributeException } from '@/orders/domain/exceptions/invalid-order-attribute.exception';

describe('manual shipment details', (): void => {
  it('accepts a carrier and tracking number and normalizes surrounding whitespace', (): void => {
    const details = ManualShipmentDetails.create(' Carrier ', ' ABC-123 ');
    expect(details.getCarrier()).toBe('Carrier');
    expect(details.getTrackingNumber()).toBe('ABC-123');
  });
  it.each([
    ['Carrier', null],
    [null, 'ABC-123'],
  ])('accepts either optional field when the other is absent', (carrier, tracking): void => {
    const details = ManualShipmentDetails.create(carrier, tracking);
    expect(details.getCarrier()).toBe(carrier);
    expect(details.getTrackingNumber()).toBe(tracking);
  });
  it.each([
    [null, null],
    [' ', ''],
    ['Bad\ncarrier', null],
    [null, 'Bad\u0000number'],
    ['a'.repeat(121), null],
    [null, 'b'.repeat(121)],
  ])('rejects missing or unsafe values', (carrier, tracking): void => {
    expect((): ManualShipmentDetails => ManualShipmentDetails.create(carrier, tracking)).toThrow(
      InvalidOrderAttributeException,
    );
  });
});
