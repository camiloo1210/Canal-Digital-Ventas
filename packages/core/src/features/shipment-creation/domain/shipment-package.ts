import { InvalidShipmentQuantityException } from '@/shipment-creation/domain/exceptions/invalid-shipment-quantity.exception';
import { MissingPackageDataException } from '@/shipment-creation/domain/exceptions/missing-package-data.exception';

export interface PackageDataProps {
  readonly weightGrams: number;
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
}

export interface ShipmentPackageItem {
  readonly quantity: number;
  readonly packageData: PackageDataProps | null;
}

export interface ShipmentPackage {
  readonly weightGrams: number;
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
}

function multiplyChecked(quantity: number, value: number): number {
  const product = quantity * value;
  if (!Number.isSafeInteger(product)) {
    throw new InvalidShipmentQuantityException(quantity);
  }
  return product;
}

function addChecked(total: number, value: number, quantity: number): number {
  const sum = total + value;
  if (!Number.isSafeInteger(sum)) {
    throw new InvalidShipmentQuantityException(quantity);
  }
  return sum;
}

export function calculateShipmentPackage(items: readonly ShipmentPackageItem[]): ShipmentPackage {
  if (items.length === 0) {
    throw new MissingPackageDataException();
  }

  let weightGrams = 0;
  let lengthMm = 0;
  let widthMm = 0;
  let heightMm = 0;

  for (const item of items) {
    if (!item.packageData) {
      throw new MissingPackageDataException();
    }
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new InvalidShipmentQuantityException(item.quantity);
    }

    const { packageData, quantity } = item;
    weightGrams = addChecked(
      weightGrams,
      multiplyChecked(quantity, packageData.weightGrams),
      quantity,
    );
    heightMm = addChecked(heightMm, multiplyChecked(quantity, packageData.heightMm), quantity);
    lengthMm = Math.max(lengthMm, packageData.lengthMm);
    widthMm = Math.max(widthMm, packageData.widthMm);
  }

  return { weightGrams, lengthMm, widthMm, heightMm };
}
