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
  };
}
