import { InvalidPackageDataException } from '@/products/domain/exceptions/invalid-package-data.exception';

export interface PackageDataInput {
  weightGrams: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

export class PackageData {
  private static readonly MAX_VALUE = 100_000_000;

  private constructor(
    public readonly weightGrams: number,
    public readonly lengthMm: number,
    public readonly widthMm: number,
    public readonly heightMm: number,
  ) {}

  public static create(input: PackageDataInput): PackageData {
    PackageData.validate('weightGrams', input.weightGrams);
    PackageData.validate('lengthMm', input.lengthMm);
    PackageData.validate('widthMm', input.widthMm);
    PackageData.validate('heightMm', input.heightMm);
    return new PackageData(input.weightGrams, input.lengthMm, input.widthMm, input.heightMm);
  }

  private static validate(field: string, value: number): void {
    if (!Number.isSafeInteger(value) || value <= 0 || value > PackageData.MAX_VALUE) {
      throw new InvalidPackageDataException(field, value);
    }
  }

  public equals(other: PackageData): boolean {
    return (
      this.weightGrams === other.weightGrams &&
      this.lengthMm === other.lengthMm &&
      this.widthMm === other.widthMm &&
      this.heightMm === other.heightMm
    );
  }
}
