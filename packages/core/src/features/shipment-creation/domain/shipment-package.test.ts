import { describe, expect, it } from 'vitest';
import { calculateShipmentPackage } from '@/shipment-creation/domain/shipment-package';
import { MissingPackageDataException } from '@/shipment-creation/domain/exceptions/missing-package-data.exception';
import { InvalidShipmentQuantityException } from '@/shipment-creation/domain/exceptions/invalid-shipment-quantity.exception';
import { DomainException } from '@/shared/domain/exceptions/domain.exception';

describe('calculateShipmentPackage', (): void => {
  it('sums weight and height by quantity and takes max length and width', (): void => {
    const result = calculateShipmentPackage([
      {
        quantity: 2,
        packageData: { weightGrams: 500, lengthMm: 300, widthMm: 200, heightMm: 100 },
      },
      {
        quantity: 1,
        packageData: { weightGrams: 1200, lengthMm: 250, widthMm: 350, heightMm: 50 },
      },
    ]);

    expect(result).toEqual({ weightGrams: 2200, lengthMm: 300, widthMm: 350, heightMm: 250 });
  });

  it('returns the single item dimensions multiplied by quantity for weight and height', (): void => {
    const result = calculateShipmentPackage([
      {
        quantity: 3,
        packageData: { weightGrams: 100, lengthMm: 10, widthMm: 20, heightMm: 30 },
      },
    ]);

    expect(result).toEqual({ weightGrams: 300, lengthMm: 10, widthMm: 20, heightMm: 90 });
  });

  it('throws MissingPackageDataException when the list is empty', (): void => {
    expect((): unknown => calculateShipmentPackage([])).toThrow(MissingPackageDataException);
  });

  it('throws MissingPackageDataException when any item has no package data', (): void => {
    expect((): unknown =>
      calculateShipmentPackage([
        {
          quantity: 1,
          packageData: { weightGrams: 100, lengthMm: 10, widthMm: 20, heightMm: 30 },
        },
        { quantity: 1, packageData: null },
      ]),
    ).toThrow(MissingPackageDataException);
  });

  for (const bad of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    it(`throws InvalidShipmentQuantityException for quantity ${bad}`, (): void => {
      expect((): unknown =>
        calculateShipmentPackage([
          {
            quantity: bad,
            packageData: { weightGrams: 100, lengthMm: 10, widthMm: 20, heightMm: 30 },
          },
        ]),
      ).toThrow(InvalidShipmentQuantityException);
    });
  }

  it('throws InvalidShipmentQuantityException when the summed weight overflows safe integers', (): void => {
    expect((): unknown =>
      calculateShipmentPackage([
        {
          quantity: Number.MAX_SAFE_INTEGER,
          packageData: { weightGrams: 100_000_000, lengthMm: 10, widthMm: 20, heightMm: 30 },
        },
      ]),
    ).toThrow(InvalidShipmentQuantityException);
  });

  it('throws a DomainException subclass', (): void => {
    expect((): unknown => calculateShipmentPackage([])).toThrow(DomainException);
  });
});
