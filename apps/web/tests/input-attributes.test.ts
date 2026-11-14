import { describe, expect, it } from 'vitest';
import {
  DECIMAL_INPUT,
  PERSON_NAME_INPUT,
  PHONE_INPUT,
  POSTAL_CODE_INPUT,
  WHOLE_NUMBER_INPUT,
  type TextInputAttributes,
} from '@/lib/input-attributes';
import { shippingOriginSchema } from '@/features/store-settings/schemas/shipping-origin.schema';
import { renameMemberSchema } from '@/features/users/schemas/users.schema';
import { createProductFormSchema } from '@/features/products/schemas/product-form.schema';

/** The browser anchors `pattern` to the whole value, using the `u` flag. */
function browserAccepts(attrs: TextInputAttributes, value: string): boolean {
  if (attrs.maxLength !== undefined && value.length > attrs.maxLength) return false;
  return new RegExp('^(?:' + attrs.pattern + ')$', 'u').test(value);
}

const UUID = '3f2b8c1e-5a4d-4e7b-9c3a-1d2e3f4a5b6c';
const shipping = {
  contactName: 'Ana',
  phone: '+593 99 123 4567',
  street: 'Calle 1',
  city: 'Quito',
  state: 'Pichincha',
  zipCode: '170150',
  country: 'EC',
};
const product = {
  name: 'Camiseta',
  sku: 'SKU-12345',
  categoryId: UUID,
  description: '',
  price: '10.50',
  cost: '5',
  wholesalePrice: '',
  wholesaleMinQuantity: '',
  stock: '10',
  isVatExempt: '',
  uploadedImagePaths: [],
  existingImages: [],
};
const productSchema = createProductFormSchema('USD');

describe('input attributes stay aligned with the server schemas', (): void => {
  it.each(['+593 99 123 4567', '(02) 255-1234', '0991234567', 'abc', '-5', '12', '1'.repeat(25)])(
    'phone %s',
    (phone): void => {
      expect(browserAccepts(PHONE_INPUT, phone)).toBe(
        shippingOriginSchema.safeParse({ ...shipping, phone }).success,
      );
    },
  );
  it.each(['170150', 'SW1A 1AA', '10001', '<script>', '1', '1'.repeat(11)])(
    'postal code %s',
    (zipCode): void => {
      expect(browserAccepts(POSTAL_CODE_INPUT, zipCode)).toBe(
        shippingOriginSchema.safeParse({ ...shipping, zipCode }).success,
      );
    },
  );
  it.each(['María-José', "O'Brien", 'Ana María', '1234', 'Ana3', '###', '-Ana'])(
    'person name %s',
    (name): void => {
      expect(browserAccepts(PERSON_NAME_INPUT, name)).toBe(
        renameMemberSchema.safeParse({ memberUserId: UUID, firstName: name, lastName: 'P' })
          .success,
      );
    },
  );
  it.each(['0', '10', '999999999', '-1', 'abc', '1e3', '1.5', '9999999999'])(
    'whole number %s',
    (stock): void => {
      expect(browserAccepts(WHOLE_NUMBER_INPUT, stock)).toBe(
        productSchema.safeParse({ ...product, stock }).success,
      );
    },
  );
  it.each(['10', '10.5', '10.55', '-10', 'abc', '1e3', '10,50', '10.555', '.5'])(
    'decimal price %s',
    (price): void => {
      const expected = productSchema.safeParse({ ...product, price }).success;
      // The browser pattern is a coarse filter: it must never reject what the server accepts.
      if (expected) expect(browserAccepts(DECIMAL_INPUT, price)).toBe(true);
      if (/[^0-9.]/.test(price)) expect(browserAccepts(DECIMAL_INPUT, price)).toBe(false);
    },
  );
  it('uses the right keyboards', (): void => {
    expect(PHONE_INPUT.inputMode).toBe('tel');
    expect(WHOLE_NUMBER_INPUT.inputMode).toBe('numeric');
    expect(DECIMAL_INPUT.inputMode).toBe('decimal');
  });
});
