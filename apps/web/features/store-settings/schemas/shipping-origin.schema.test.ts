import { describe, expect, it } from 'vitest';
import { shippingOriginSchema } from '@/features/store-settings/schemas/shipping-origin.schema';

const valid = {
  contactName: 'Ana Gomez',
  phone: '3001234567',
  street: 'Calle 1 # 2-3',
  city: 'Bogota',
  state: 'DC',
  zipCode: '110111',
  country: 'CO',
};

describe('shippingOriginSchema', (): void => {
  it('accepts a valid origin', (): void => {
    expect(shippingOriginSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects a blank street', (): void => {
    expect(shippingOriginSchema.safeParse({ ...valid, street: '  ' }).success).toBe(false);
  });
  it('rejects a lowercase country', (): void => {
    expect(shippingOriginSchema.safeParse({ ...valid, country: 'col' }).success).toBe(false);
  });
  it('rejects values over 120 characters', (): void => {
    expect(shippingOriginSchema.safeParse({ ...valid, city: 'x'.repeat(121) }).success).toBe(false);
  });
});
