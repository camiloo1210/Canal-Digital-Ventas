import { describe, expect, it } from 'vitest';
import { PackageData } from '@/products/domain/value-objects/package-data.vo';
import { InvalidPackageDataException } from '@/products/domain/exceptions/invalid-package-data.exception';
import { DomainException } from '@/shared/domain/exceptions/domain.exception';

const valid = { weightGrams: 500, lengthMm: 300, widthMm: 200, heightMm: 100 };

describe('PackageData', (): void => {
  it('accepts positive integer values and exposes getters', (): void => {
    const data = PackageData.create(valid);
    expect(data.weightGrams).toBe(500);
    expect(data.lengthMm).toBe(300);
    expect(data.widthMm).toBe(200);
    expect(data.heightMm).toBe(100);
  });

  it('accepts the upper bound 100_000_000', (): void => {
    expect(PackageData.create({ ...valid, weightGrams: 100_000_000 }).weightGrams).toBe(
      100_000_000,
    );
  });

  const fields = ['weightGrams', 'lengthMm', 'widthMm', 'heightMm'] as const;
  for (const field of fields) {
    for (const bad of [0, -1, 1.5, 100_000_001, Number.NaN, Infinity]) {
      it(`rejects ${field}=${bad}`, (): void => {
        expect((): PackageData => PackageData.create({ ...valid, [field]: bad })).toThrow(
          InvalidPackageDataException,
        );
      });
    }
  }

  it('throws a DomainException subclass', (): void => {
    expect((): PackageData => PackageData.create({ ...valid, weightGrams: 0 })).toThrow(
      DomainException,
    );
  });
});
