import { z } from 'zod';
import { currencyExponent } from '@canaldigital/packages/core/money-format';
import { parseToMinorUnits } from '@/lib/money';

export const PRODUCT_IMAGE_MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_MAX_COUNT = 8;
export const PRODUCT_IMAGE_BUCKET = 'products';

const OBJECT_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/** Validates storage object keys previously issued for the session tenant. */
export function uploadedImagePathsSchema(tenantId: string): z.ZodType<string[]> {
  const prefix = tenantId + '/';
  return z
    .array(
      z
        .string()
        .refine(
          (path): boolean =>
            path.startsWith(prefix) && OBJECT_NAME_PATTERN.test(path.slice(prefix.length)),
          'imageFormat',
        ),
    )
    .max(PRODUCT_IMAGE_MAX_COUNT, 'imageCount')
    .refine((paths): boolean => new Set(paths).size === paths.length, 'imageFormat');
}

/**
 * Currency-aware money string: at most `exponent` fraction digits (none for CLP), never rounded,
 * bounded by MAX_MONEY_CENTS. All parsing is delegated to the single `parseToMinorUnits`.
 */
function moneyString(currency: string): z.ZodType<number, string> {
  return z.string().transform((value, ctx): number => {
    try {
      return parseToMinorUnits(value, currency);
    } catch (error: unknown) {
      const range = error instanceof Error && error.message.includes('bounds');
      ctx.addIssue({
        code: 'custom',
        message: range
          ? 'moneyRange'
          : currencyExponent(currency) === 0
            ? 'moneyFormatWhole'
            : 'moneyFormat',
      });
      return z.NEVER;
    }
  });
}
function optionalMoneyString(currency: string): z.ZodType<number | null, string> {
  const money = moneyString(currency);
  return z.union([z.literal(''), z.string()]).transform((value, ctx): number | null => {
    if (value === '') return null;
    const result = money.safeParse(value);
    if (result.success) return result.data;
    for (const issue of result.error.issues)
      ctx.addIssue({ code: 'custom', message: issue.message });
    return z.NEVER;
  });
}
const integerString = z
  .string()
  .regex(/^\d+$/, 'integerFormat')
  .refine((value): boolean => Number.isSafeInteger(Number(value)), 'integerFormat');
const optionalInteger = z
  .union([z.literal(''), integerString])
  .transform((value): number | null => (value === '' ? null : Number(value)));

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- zod object type is inferred; spelling it out would duplicate the schema
export function createProductFormSchema(currency: string) {
  return z.object({
    name: z.string().trim().min(2, 'nameMin').max(50, 'nameMax'),
    sku: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9-]{5,20}$/, 'skuFormat'),
    categoryId: z.string().uuid('categoryRequired'),
    description: z.string().max(200, 'descriptionMax'),
    price: moneyString(currency),
    cost: moneyString(currency),
    wholesalePrice: optionalMoneyString(currency),
    wholesaleMinQuantity: optionalInteger,
    stock: integerString.transform((value): number => Number(value)),
    isVatExempt: z
      .enum(['', 'on', 'true', 'false'], { message: 'booleanFormat' })
      .transform((value): boolean => value === 'on' || value === 'true'),
    uploadedImagePaths: z.array(z.string()).max(PRODUCT_IMAGE_MAX_COUNT, 'imageCount'),
    existingImages: z
      .array(z.string().url('imageFormat'))
      .max(PRODUCT_IMAGE_MAX_COUNT, 'imageCount'),
  });
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- zod object type is inferred from createProductFormSchema
export function createUpdateProductFormSchema(currency: string) {
  return createProductFormSchema(currency).extend({
    productId: z.string().uuid('invalidRequest'),
    expectedVersion: integerString.transform((value): number => Number(value)),
  });
}

export interface PackageUnits {
  weightGrams: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}
export interface PackageFormFields {
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
}
const PACKAGE_MAX_UNITS = 100_000_000;
const PACKAGE_FIELD_NAMES = ['weightKg', 'lengthCm', 'widthCm', 'heightCm'] as const;

/** Converts a non-negative decimal string to integer units by digit concatenation (no float math). */
function decimalToUnits(value: string, decimals: number): number | null {
  const match = new RegExp(String.raw`^(\d+)(?:\.(\d{1,${decimals}}))?$`).exec(value);
  if (!match) return null;
  const units = Number((match[1] ?? '') + (match[2] ?? '').padEnd(decimals, '0'));
  return Number.isSafeInteger(units) ? units : null;
}

function unitsToDecimal(units: number, decimals: number): string {
  const digits = String(units).padStart(decimals + 1, '0');
  return digits.slice(0, digits.length - decimals) + '.' + digits.slice(digits.length - decimals);
}

/**
 * Converts the kg/cm form strings into integer grams/mm. All four empty yields `null`.
 * Throws a RangeError on partial or malformed input; the Zod schema reports those per field.
 */
export function parsePackageFields(raw: PackageFormFields): PackageUnits | null {
  const [weight, length, width, height] = PACKAGE_FIELD_NAMES.map((name): string =>
    raw[name].trim(),
  );
  if (weight === '' && length === '' && width === '' && height === '') return null;
  const weightGrams = decimalToUnits(weight ?? '', 3);
  const lengthMm = decimalToUnits(length ?? '', 1);
  const widthMm = decimalToUnits(width ?? '', 1);
  const heightMm = decimalToUnits(height ?? '', 1);
  if (weightGrams === null || lengthMm === null || widthMm === null || heightMm === null)
    throw new RangeError('Invalid package fields');
  return { weightGrams, lengthMm, widthMm, heightMm };
}

/** Inverse of parsePackageFields, used to prefill the edit form. */
export function formatPackageFields(units: PackageUnits | null): PackageFormFields {
  if (!units) return { weightKg: '', lengthCm: '', widthCm: '', heightCm: '' };
  return {
    weightKg: unitsToDecimal(units.weightGrams, 3),
    lengthCm: unitsToDecimal(units.lengthMm, 1),
    widthCm: unitsToDecimal(units.widthMm, 1),
    heightCm: unitsToDecimal(units.heightMm, 1),
  };
}

/**
 * Package group syntax: all empty is valid (null), a partial group flags the empty fields, and
 * filled fields must be positive decimals within the supported scale and range.
 */
export const packageFieldsSchema: z.ZodType<PackageUnits | null, PackageFormFields> = z
  .object({
    weightKg: z.string().trim(),
    lengthCm: z.string().trim(),
    widthCm: z.string().trim(),
    heightCm: z.string().trim(),
  })
  .transform((raw, ctx): PackageUnits | null => {
    if (PACKAGE_FIELD_NAMES.every((name): boolean => raw[name] === '')) return null;
    let valid = true;
    for (const name of PACKAGE_FIELD_NAMES) {
      const decimals = name === 'weightKg' ? 3 : 1;
      const units = raw[name] === '' ? null : decimalToUnits(raw[name], decimals);
      const message =
        raw[name] === ''
          ? 'packageIncomplete'
          : units === null || units <= 0
            ? name === 'weightKg'
              ? 'weightFormat'
              : 'dimensionFormat'
            : units > PACKAGE_MAX_UNITS
              ? 'packageRange'
              : null;
      if (message) {
        valid = false;
        ctx.addIssue({ code: 'custom', path: [name], message });
      }
    }
    return valid ? parsePackageFields(raw) : z.NEVER;
  });

export interface ProductFormValues {
  name: string;
  sku: string;
  categoryId: string;
  description: string;
  price: string;
  cost: string;
  wholesalePrice: string;
  wholesaleMinQuantity: string;
  stock: string;
  isVatExempt: string;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
}
export type ProductFieldName = keyof ProductFormValues | 'image';
export interface ProductActionState {
  success: boolean;
  error: string | null;
  fieldErrors?: Partial<Record<ProductFieldName, string[]>>;
  values?: ProductFormValues;
  revision?: number;
}
export interface ProductEditValues extends ProductFormValues {
  id: string;
  version: number;
  imageUrl: string | null;
  galleryUrls: string[];
}

export function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export function extractProductFormValues(formData: FormData): ProductFormValues {
  return {
    name: readFormString(formData, 'name'),
    sku: readFormString(formData, 'sku'),
    categoryId: readFormString(formData, 'categoryId'),
    description: readFormString(formData, 'description'),
    price: readFormString(formData, 'price'),
    cost: readFormString(formData, 'cost'),
    wholesalePrice: readFormString(formData, 'wholesalePrice'),
    wholesaleMinQuantity: readFormString(formData, 'wholesaleMinQuantity'),
    stock: readFormString(formData, 'stock'),
    isVatExempt: readFormString(formData, 'isVatExempt'),
    weightKg: readFormString(formData, 'weightKg'),
    lengthCm: readFormString(formData, 'lengthCm'),
    widthCm: readFormString(formData, 'widthCm'),
    heightCm: readFormString(formData, 'heightCm'),
  };
}
