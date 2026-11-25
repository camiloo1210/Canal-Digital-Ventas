import { describe, expect, it } from 'vitest';
import {
  CheckoutDetailsSchema,
  checkoutFieldMessageKey,
  checkoutFields,
} from '@/features/checkout/schemas/checkout.schema';
import es from '@/messages/es.json';
import en from '@/messages/en.json';

const valid = {
  'customer.name': 'Ana Pérez',
  'customer.email': 'ana@example.com',
  'customer.phone': '+593 99 123 4567',
  'customer.documentId': '1712345678',
  'shipping.street': 'Av. Amazonas N24-15 y Colón',
  'shipping.city': 'Quito',
  'shipping.state': 'Pichincha',
  'shipping.zipCode': '170150',
  'shipping.country': 'Ecuador',
  'shipping.reference': '',
};
const accepts = (patch: Record<string, string>): boolean =>
  CheckoutDetailsSchema.safeParse({ ...valid, ...patch }).success;

describe('checkout details validation', (): void => {
  it('accepts a complete, well-formed order', (): void => {
    expect(accepts({})).toBe(true);
    expect(accepts({ 'customer.phone': '(02) 255-1234' })).toBe(true);
    expect(accepts({ 'shipping.zipCode': 'SW1A 1AA', 'shipping.country': 'United Kingdom' })).toBe(
      true,
    );
    expect(accepts({ 'customer.documentId': 'AB123456' })).toBe(true);
  });
  it.each(['abc', 'llámame', 'telefono', '-5', '12', '+', '99 99 99 abc', '1'.repeat(25)])(
    'rejects phone %s',
    (phone): void => {
      expect(accepts({ 'customer.phone': phone })).toBe(false);
    },
  );
  it.each(['1234', 'Ana3', '###', '-Ana', '12345678'])('rejects name %s', (name): void => {
    expect(accepts({ 'customer.name': name })).toBe(false);
  });
  it.each(['abc', '12', '!!!!!!', '1234 5678', 'a'.repeat(21)])(
    'rejects document %s',
    (id): void => {
      expect(accepts({ 'customer.documentId': id })).toBe(false);
    },
  );
  it.each(['12345', 'Quito2', '###'])('rejects city %s', (city): void => {
    expect(accepts({ 'shipping.city': city })).toBe(false);
  });
  it.each(['123', 'Pich1ncha'])('rejects state %s', (state): void => {
    expect(accepts({ 'shipping.state': state })).toBe(false);
  });
  it.each(['9999', 'Ecu4dor'])('rejects country %s', (country): void => {
    expect(accepts({ 'shipping.country': country })).toBe(false);
  });
  it.each(['<script>', '1', '!!!!!'])('rejects zip %s', (zip): void => {
    expect(accepts({ 'shipping.zipCode': zip })).toBe(false);
  });
  it('rejects an invalid email', (): void => {
    expect(accepts({ 'customer.email': 'no-es-un-correo' })).toBe(false);
  });
});

describe('checkout field attributes', (): void => {
  const byName = Object.fromEntries(checkoutFields.map((field) => [field.name, field]));
  it('gives every constrained field native constraints', (): void => {
    for (const name of [
      'customer.name',
      'customer.phone',
      'customer.documentId',
      'shipping.city',
      'shipping.state',
      'shipping.zipCode',
      'shipping.country',
    ]) {
      const input = (byName[name] as { input?: { pattern: string; maxLength: number } }).input;
      expect(input?.pattern, name).toBeTruthy();
      expect(input?.maxLength, name).toBeLessThanOrEqual(100);
    }
  });
  it('uses the telephone keyboard for the phone', (): void => {
    const input = (byName['customer.phone'] as { input?: { inputMode: string } }).input;
    expect(input?.inputMode).toBe('tel');
  });
});

describe('checkout error messages', (): void => {
  it('explains each constrained field specifically, in both locales', (): void => {
    for (const messages of [es, en]) {
      const checkout = (
        messages as unknown as Record<string, Record<string, Record<string, string>>>
      ).Storefront.checkoutErrors;
      for (const field of checkoutFields) {
        const key = checkoutFieldMessageKey(field.name);
        expect(checkout[key], field.name + ' -> ' + key).toBeTruthy();
      }
    }
  });
  it('keeps the email message for the email field', (): void => {
    expect(checkoutFieldMessageKey('customer.email')).toBe('invalidEmail');
    expect(checkoutFieldMessageKey('customer.phone')).toBe('invalidPhone');
  });
});
