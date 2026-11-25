import { describe, it, expect } from 'vitest';
import { ShippingOrigin } from '@/tenants/domain/value-objects/shipping-origin.vo';
import { InvalidShippingOriginException } from '@/tenants/domain/exceptions/invalid-shipping-origin.exception';

const valid = {
  contactName: ' Ana Gomez ',
  phone: '3001234567',
  street: 'Calle 1 # 2-3',
  city: 'Bogota',
  state: 'DC',
  zipCode: '110111',
  country: 'CO',
};

describe('ShippingOrigin', (): void => {
  it('accepts a valid origin and trims text', (): void => {
    expect(ShippingOrigin.create(valid).toProps()).toEqual({ ...valid, contactName: 'Ana Gomez' });
  });
  it('rejects a blank street', (): void => {
    expect((): ShippingOrigin => ShippingOrigin.create({ ...valid, street: '   ' })).toThrow(
      InvalidShippingOriginException,
    );
  });
  it('rejects a lowercase country', (): void => {
    expect((): ShippingOrigin => ShippingOrigin.create({ ...valid, country: 'col' })).toThrow(
      InvalidShippingOriginException,
    );
  });
  it('rejects values over 120 characters', (): void => {
    expect((): ShippingOrigin =>
      ShippingOrigin.create({ ...valid, city: 'x'.repeat(121) }),
    ).toThrow(InvalidShippingOriginException);
  });
});
