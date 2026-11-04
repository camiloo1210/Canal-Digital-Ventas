import { describe, expect, it } from 'vitest';
import { AgeRange } from '@/iam/domain/value-objects/age-range.vo';
import { Gender } from '@/iam/domain/value-objects/gender.vo';
import { Province } from '@/iam/domain/value-objects/province.vo';
import { InvalidDemographicBucketException } from '@/iam/domain/exceptions/invalid-demographic-bucket.exception';
import { resolveEffectivePermissions } from '@/iam/domain/effective-permissions';
import { UserPermission } from '@/iam/domain/enums/permission.enum';

describe('demographic bucket value objects', () => {
  it('accept only fixed values', () => {
    expect(AgeRange.create('25_34').getValue()).toBe('25_34');
    expect(Gender.create('PREFER_NOT_TO_SAY').getValue()).toBe('PREFER_NOT_TO_SAY');
    expect(Province.create('PICHINCHA').getValue()).toBe('PICHINCHA');
  });

  it('reject exact ages and free text', () => {
    expect(() => AgeRange.create('27')).toThrow(InvalidDemographicBucketException);
    expect(() => Gender.create('x')).toThrow(InvalidDemographicBucketException);
    expect(() => Province.create('Quito, Av. Amazonas 123')).toThrow(
      InvalidDemographicBucketException,
    );
  });
});

describe('resolveEffectivePermissions', () => {
  it('gives OWNER every permission', () => {
    expect(resolveEffectivePermissions('OWNER', [])).toEqual(Object.values(UserPermission));
  });
  it('gives base-role ADMIN every permission so existing admins keep access', () => {
    expect(resolveEffectivePermissions('ADMIN', [])).toEqual(Object.values(UserPermission));
  });
  it('gives members only their role permissions, ignoring unknown values', () => {
    expect(resolveEffectivePermissions('MEMBER', ['VIEW_ORDERS', 'BOGUS'])).toEqual([
      UserPermission.VIEW_ORDERS,
    ]);
    expect(resolveEffectivePermissions('MEMBER', [])).toEqual([]);
  });
});
