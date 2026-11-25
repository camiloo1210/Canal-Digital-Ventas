import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import es from '@/messages/es.json';
import { ProductFormFields } from '@/features/products/components/product-form-fields';
import { CategoryFormFields } from '@/features/categories/components/category-form-fields';
import { OnboardingForm } from '@/features/iam/ui/components/onboarding-form';
import { SignupBusinessForm } from '@/features/iam/ui/components/signup-business-form';
import { SignupClientForm } from '@/features/iam/ui/components/signup-client-form';
import { SignupCustomerForm } from '@/features/iam/ui/components/signup-customer-form';
import {
  KIVI_CODE_PATTERN,
  KIVI_LANGUAGE_PATTERN,
  KIVI_PHONE_NUMBER_ID_PATTERN,
  KIVI_TEMPLATE_PATTERN,
} from '@/features/kivi/schemas/kivi-input-patterns';
import { pairKiviSchema } from '@/features/kivi/schemas/kivi-connection.schema';
import { kiviWhatsAppSchema } from '@/features/kivi/schemas/kivi-whatsapp.schema';
import { kiviNotificationsSchema } from '@/features/kivi/schemas/kivi-notifications.schema';
import { SKU_INPUT, inputPatternRegex } from '@/lib/input-attributes';
import { createProductFormSchema } from '@/features/products/schemas/product-form.schema';

vi.mock('@/features/products/actions/product-image-uploads.actions', (): object => ({
  createProductImageUploadsAction: vi.fn(),
}));
vi.mock('@/features/iam/actions/onboarding.actions', (): object => ({
  onboardBusinessAction: vi.fn(),
}));
vi.mock('@/features/iam/actions/signup.actions', (): object => ({
  signupBusinessAction: vi.fn(),
  signupCustomerAction: vi.fn(),
}));
vi.mock('@/features/iam/actions/signup-client.actions', (): object => ({
  signupClientAction: vi.fn(),
}));
vi.mock('@/features/iam/actions/login.actions', (): object => ({
  loginBusinessWithGoogleAction: vi.fn(),
  loginWithGoogleAction: vi.fn(),
}));

function render(node: React.ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="es" timeZone="America/Guayaquil" messages={es}>
      {node}
    </NextIntlClientProvider>,
  );
}
function field(html: string, tag: 'input' | 'textarea', id: string): string {
  const match = new RegExp('<' + tag + '[^>]*id="' + id + '"[^>]*>').exec(html);
  if (!match) throw new Error(tag + ' not found: ' + id);
  return match[0];
}

describe('catalog text limits mirror the server', (): void => {
  const product = render(
    <ProductFormFields
      categories={[]}
      currency="USD"
      managed={false}
      revision={0}
      fieldErrors={{}}
      clearField={(): void => undefined}
    />,
  );
  const category = render(
    <CategoryFormFields revision={0} fieldErrors={{}} clearField={(): void => undefined} />,
  );
  it('limits the product name, SKU and description', (): void => {
    expect(field(product, 'input', 'name')).toContain('maxLength="50"');
    expect(field(product, 'input', 'name')).toContain('minLength="2"');
    expect(field(product, 'input', 'sku')).toContain('maxLength="20"');
    expect(field(product, 'input', 'sku')).toContain('minLength="5"');
    expect(field(product, 'input', 'sku')).toContain('pattern="' + SKU_INPUT.pattern + '"');
    expect(field(product, 'textarea', 'description')).toContain('maxLength="200"');
  });
  it('limits the category name and description', (): void => {
    expect(field(category, 'input', 'name')).toContain('maxLength="100"');
    expect(field(category, 'textarea', 'description')).toContain('maxLength="200"');
  });
  it('keeps the SKU constraint aligned with the product schema', (): void => {
    const schema = createProductFormSchema('USD');
    const base = {
      name: 'Camiseta',
      categoryId: '3f2b8c1e-5a4d-4e7b-9c3a-1d2e3f4a5b6c',
      description: '',
      price: '1',
      cost: '1',
      wholesalePrice: '',
      wholesaleMinQuantity: '',
      stock: '1',
      isVatExempt: '',
      uploadedImagePaths: [],
      existingImages: [],
    };
    for (const sku of ['ABC-123', 'abcde', 'ab', 'ABC 123', 'ABC_123', 'a'.repeat(21), 'ñandú-1'])
      expect(
        inputPatternRegex(SKU_INPUT).test(sku) && sku.length >= 5 && sku.length <= 20,
        sku,
      ).toBe(schema.safeParse({ ...base, sku }).success);
  });
});

describe('authentication forms', (): void => {
  const onboarding = render(<OnboardingForm />);
  const business = render(<SignupBusinessForm />);
  const client = render(
    <SignupClientForm options={{ ageRanges: [], genders: [], provinces: [] } as never} />,
  );
  const customer = render(<SignupCustomerForm />);

  it.each([
    ['onboarding', onboarding],
    ['business signup', business],
  ])('%s restricts names to letters', (_label, html): void => {
    for (const id of ['firstName', 'lastName']) {
      const tag = field(html, 'input', id);
      expect(tag).toContain('pattern=');
      expect(tag).toContain('maxLength="60"');
    }
  });
  it.each([
    ['onboarding', onboarding],
    ['business signup', business],
  ])('%s limits the store name and constrains the store URL', (_label, html): void => {
    expect(field(html, 'input', 'storeName')).toContain('maxLength="100"');
    expect(field(html, 'input', 'storeName')).toContain('minLength="3"');
    const slug = field(html, 'input', 'storeSlug');
    expect(slug).toContain('maxLength="50"');
    expect(slug).toContain('minLength="3"');
    expect(slug).toContain('pattern=');
  });
  it.each([
    ['business signup', business],
    ['buyer signup', client],
    ['customer signup', customer],
  ])('%s caps the email and password length', (_label, html): void => {
    expect(field(html, 'input', 'email')).toContain('maxLength="254"');
    const password = field(html, 'input', 'password');
    expect(password).toContain('maxLength="128"');
    expect(password).toContain('minLength="6"');
    expect(password).toContain('autoComplete="new-password"');
  });
});

describe('kivi field patterns mirror their schemas', (): void => {
  const matches = (pattern: string, value: string): boolean =>
    new RegExp('^(?:' + pattern + ')$', 'u').test(value);
  it.each(['kvp_abcdefgh', 'kvp_short', 'abc_12345678', 'kvp_ab cd1234', 'kvp_' + 'a'.repeat(201)])(
    'pairing code %s',
    (code): void => {
      expect(matches(KIVI_CODE_PATTERN, code)).toBe(pairKiviSchema.safeParse({ code }).success);
    },
  );
  it.each(['123456789012345', 'abc_DEF-1', '', 'with space', 'x'.repeat(65)])(
    'phone number id %s',
    (phoneNumberId): void => {
      expect(matches(KIVI_PHONE_NUMBER_ID_PATTERN, phoneNumberId)).toBe(
        kiviWhatsAppSchema.safeParse({ operation: 'connect', phoneNumberId, token: 'tok_123' })
          .success,
      );
    },
  );
  it.each([
    'order_update',
    'Order',
    '1order',
    'order-update',
    'o',
    'a'.repeat(100),
    'a'.repeat(101),
  ])('template name %s', (templateName): void => {
    expect(matches(KIVI_TEMPLATE_PATTERN, templateName)).toBe(
      kiviNotificationsSchema.safeParse({
        whatsappEnabled: true,
        widgetEnabled: true,
        templateName,
        language: 'es',
      }).success,
    );
  });
  it.each(['es', 'en', 'es_EC', 'fr', 'es_ec', 'ES', 'en_USA'])('language %s', (language): void => {
    expect(matches(KIVI_LANGUAGE_PATTERN, language)).toBe(
      kiviNotificationsSchema.safeParse({
        whatsappEnabled: true,
        widgetEnabled: true,
        templateName: 'order_update',
        language,
      }).success,
    );
  });
});
