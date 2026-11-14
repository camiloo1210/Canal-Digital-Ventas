import { describe, expect, it } from 'vitest';
import {
  clientSignupSchema,
  customerSignupSchema,
  onboardingSchema,
  signupBusinessSchema,
} from '@/features/iam/schemas/auth.schema';
import {
  EMAIL_INPUT,
  NEW_PASSWORD_INPUT,
  STORE_NAME_INPUT,
  STORE_SLUG_INPUT,
  type TextInputAttributes,
} from '@/lib/input-attributes';
import es from '@/messages/es.json';
import en from '@/messages/en.json';

const business = {
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.com',
  password: 'secreto1',
  storeName: 'Mi Tienda 2',
  storeSlug: 'mi-tienda-2',
};
const onboarding = {
  firstName: 'Ana',
  lastName: 'Pérez',
  storeName: 'Mi Tienda 2',
  storeSlug: 'mi-tienda-2',
};
const businessOk = (patch: Record<string, string>): boolean =>
  signupBusinessSchema.safeParse({ ...business, ...patch }).success;
const onboardingOk = (patch: Record<string, string>): boolean =>
  onboardingSchema.safeParse({ ...onboarding, ...patch }).success;

describe('business signup', (): void => {
  it('accepts a well-formed registration', (): void => {
    expect(businessOk({})).toBe(true);
  });
  it.each(['123', 'Ana3', '###', '-Ana', '  ', ''])('rejects first name %s', (value): void => {
    expect(businessOk({ firstName: value })).toBe(false);
  });
  it.each(['1234', 'Pérez9', '@@'])('rejects last name %s', (value): void => {
    expect(businessOk({ lastName: value })).toBe(false);
  });
  it('rejects names beyond 60 characters', (): void => {
    expect(businessOk({ firstName: 'A'.repeat(61) })).toBe(false);
  });
  it.each(['no-es-correo', 'a@b', '@example.com', 'a'.repeat(250) + '@example.com'])(
    'rejects email %s',
    (value): void => {
      expect(businessOk({ email: value })).toBe(false);
    },
  );
  it.each(['abc', '12345', 'a'.repeat(129)])('rejects password of bad length %#', (value): void => {
    expect(businessOk({ password: value })).toBe(false);
  });
  it.each(['ab', '  ', 'x'.repeat(101)])('rejects store name %#', (value): void => {
    expect(businessOk({ storeName: value })).toBe(false);
  });
  it.each([
    'Mi Tienda',
    'ñandú',
    '---',
    'a--b',
    '-abc',
    'abc-',
    'ab',
    'mi_tienda',
    'a'.repeat(51),
    'mi tienda!',
  ])('rejects store URL %s', (value): void => {
    expect(businessOk({ storeSlug: value })).toBe(false);
  });
  it('accepts hyphenated lowercase store URLs', (): void => {
    for (const slug of ['abc', 'mi-tienda', 'tienda-2-norte', 'a1b2c3'])
      expect(businessOk({ storeSlug: slug }), slug).toBe(true);
  });
});

describe('onboarding', (): void => {
  it('accepts a well-formed payload', (): void => {
    expect(onboardingOk({})).toBe(true);
  });
  it.each(['123', 'A', '#x', 'Ana3'])('rejects first name %s', (value): void => {
    expect(onboardingOk({ firstName: value })).toBe(false);
  });
  it.each(['---', 'a--b', '-abc', 'abc-', 'ab', 'Mi Tienda', 'a'.repeat(51)])(
    'rejects store URL %s',
    (value): void => {
      expect(onboardingOk({ storeSlug: value })).toBe(false);
    },
  );
  it.each(['ab', 'x'.repeat(101)])('rejects store name %#', (value): void => {
    expect(onboardingOk({ storeName: value })).toBe(false);
  });
});

describe('buyer signup', (): void => {
  const fine = { email: 'comprador@example.com', password: 'secreto1' };
  it.each([customerSignupSchema, clientSignupSchema])(
    'validates email and password',
    (schema): void => {
      expect(schema.safeParse(fine).success).toBe(true);
      expect(schema.safeParse({ ...fine, email: 'x' }).success).toBe(false);
      expect(schema.safeParse({ ...fine, password: '123' }).success).toBe(false);
      expect(schema.safeParse({ ...fine, password: 'a'.repeat(129) }).success).toBe(false);
      expect(schema.safeParse({ ...fine, email: 'a'.repeat(250) + '@example.com' }).success).toBe(
        false,
      );
    },
  );
});

describe('browser constraints match the server', (): void => {
  const accepts = (attributes: TextInputAttributes, value: string): boolean =>
    value.length <= attributes.maxLength &&
    value.length >= (attributes.minLength ?? 0) &&
    new RegExp('^(?:' + attributes.pattern + ')$', 'u').test(value);
  it.each(['abc', 'mi-tienda', '---', 'a--b', 'Mi Tienda', 'ab', 'a'.repeat(51), 'ñandú'])(
    'store URL %s',
    (slug): void => {
      expect(accepts(STORE_SLUG_INPUT, slug)).toBe(businessOk({ storeSlug: slug }));
    },
  );
  it.each(['Mi Tienda', 'ab', 'x'.repeat(101), '  ', 'Tienda 24/7'])(
    'store name %#',
    (name): void => {
      expect(accepts(STORE_NAME_INPUT, name)).toBe(businessOk({ storeName: name }));
    },
  );
  it('declares sensible limits for credentials', (): void => {
    expect(EMAIL_INPUT.maxLength).toBe(254);
    expect(NEW_PASSWORD_INPUT.maxLength).toBe(128);
    expect(NEW_PASSWORD_INPUT.minLength).toBe(6);
    expect(NEW_PASSWORD_INPUT.autoComplete).toBe('new-password');
  });
});

describe('error messages are translated keys', (): void => {
  const messageOf = (result: {
    success: boolean;
    error?: { issues: { message: string }[] };
  }): string[] =>
    result.success ? [] : (result.error?.issues ?? []).map((issue): string => issue.message);
  const keys = new Set<string>([
    ...messageOf(
      signupBusinessSchema.safeParse({
        firstName: '1',
        lastName: '1',
        email: 'x',
        password: '1',
        storeName: '1',
        storeSlug: '!',
      }),
    ),
    ...messageOf(
      onboardingSchema.safeParse({ firstName: '1', lastName: '1', storeName: '1', storeSlug: '!' }),
    ),
    ...messageOf(customerSignupSchema.safeParse({ email: 'x', password: '1' })),
  ]);
  it('only uses keys that exist in both locales', (): void => {
    expect(keys.size).toBeGreaterThan(0);
    for (const messages of [es, en]) {
      const errors = (
        messages as unknown as Record<
          string,
          Record<string, Record<string, Record<string, string>>>
        >
      ).Storefront.auth.errors;
      for (const key of keys) expect(errors[key], key).toBeTruthy();
    }
  });
});
