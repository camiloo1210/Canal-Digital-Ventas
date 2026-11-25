import { describe, expect, it } from 'vitest';
import { shippingOriginSchema } from '@/features/store-settings/schemas/shipping-origin.schema';
import { createInvitationSchema, renameMemberSchema } from '@/features/users/schemas/users.schema';
import { createProductFormSchema } from '@/features/products/schemas/product-form.schema';

const UUID = '3f2b8c1e-5a4d-4e7b-9c3a-1d2e3f4a5b6c';

describe('shipping origin contact fields', (): void => {
  const valid = {
    contactName: 'Ana Pérez',
    phone: '+593 99 123 4567',
    street: 'Av. Amazonas N24',
    city: 'Quito',
    state: 'Pichincha',
    zipCode: '170150',
    country: 'EC',
  };
  it('accepts real phone numbers and postal codes', (): void => {
    expect(shippingOriginSchema.safeParse(valid).success).toBe(true);
    expect(shippingOriginSchema.safeParse({ ...valid, phone: '(02) 255-1234' }).success).toBe(true);
    expect(shippingOriginSchema.safeParse({ ...valid, zipCode: 'SW1A 1AA' }).success).toBe(true);
  });
  it.each(['abc', 'llámame', '-5', '12', '+', '99 99 99 abc', '1'.repeat(25)])(
    'rejects phone %s',
    (phone): void => {
      expect(shippingOriginSchema.safeParse({ ...valid, phone }).success).toBe(false);
    },
  );
  it.each(['<script>', '1', '!!!!!', '1'.repeat(11)])('rejects postal code %s', (zipCode): void => {
    expect(shippingOriginSchema.safeParse({ ...valid, zipCode }).success).toBe(false);
  });
});

describe('invitation numeric fields', (): void => {
  const base = { roleId: UUID, accountMode: 'GENERATED_EMAIL' };
  it('accepts plain positive whole numbers', (): void => {
    expect(
      createInvitationSchema.safeParse({ ...base, expiresInDays: '7', maxUses: '5' }).success,
    ).toBe(true);
  });
  it.each(['1e1', '0x5', '-1', '1.5', '0', 'abc', '', ' ', '5abc', '+5'])(
    'rejects maxUses %s',
    (maxUses): void => {
      expect(
        createInvitationSchema.safeParse({ ...base, expiresInDays: '7', maxUses }).success,
      ).toBe(false);
    },
  );
  it.each(['1e1', '-3', '2.5', 'x', ''])('rejects expiresInDays %s', (expiresInDays): void => {
    expect(createInvitationSchema.safeParse({ ...base, expiresInDays, maxUses: '5' }).success).toBe(
      false,
    );
  });
});

describe('person names', (): void => {
  const target = { memberUserId: UUID };
  it.each(['María-José', "O'Brien", 'Ana María', 'Nuñez'])('accepts %s', (name): void => {
    const result = renameMemberSchema.safeParse({ ...target, firstName: name, lastName: 'Pérez' });
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });
  it.each(['1234', 'Ana3', '###', '-Ana', '  '])('rejects %s', (name): void => {
    expect(
      renameMemberSchema.safeParse({ ...target, firstName: name, lastName: 'Pérez' }).success,
    ).toBe(false);
  });
});

describe('product numeric fields', (): void => {
  const schema = createProductFormSchema('USD');
  const valid = {
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
  it('accepts valid values', (): void => {
    expect(schema.safeParse(valid).success).toBe(true);
  });
  it.each(['-5', '12abc', '1e3', '1.5', ' ', '', '0x10', '99999999999'])(
    'rejects stock %s',
    (stock): void => {
      expect(schema.safeParse({ ...valid, stock }).success).toBe(false);
    },
  );
  it.each(['-1', 'abc', '1e3', '1.5', '999999999999'])(
    'rejects wholesale quantity %s',
    (wholesaleMinQuantity): void => {
      expect(schema.safeParse({ ...valid, wholesaleMinQuantity }).success).toBe(false);
    },
  );
  it.each(['-10', 'abc', '1e3', '10,50', '10.555', '--5'])('rejects price %s', (price): void => {
    expect(schema.safeParse({ ...valid, price }).success).toBe(false);
  });
});
