import { z } from 'zod';
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

const decimalPattern = /^\d+(\.\d{1,2})?$/;
const decimalString = z
  .string()
  .regex(decimalPattern, 'moneyFormat')
  .refine((value): boolean => {
    if (!decimalPattern.test(value)) return true;
    const [whole, fraction = ''] = value.split('.');
    return (
      BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0')) <=
      BigInt(Number.MAX_SAFE_INTEGER)
    );
  }, 'moneyRange');
const money = decimalString.transform((value): number => parseToMinorUnits(value));
const optionalMoney = z
  .union([z.literal(''), decimalString])
  .transform((value): number | null => (value === '' ? null : parseToMinorUnits(value)));
const integerString = z
  .string()
  .regex(/^\d+$/, 'integerFormat')
  .refine((value): boolean => Number.isSafeInteger(Number(value)), 'integerFormat');
const optionalInteger = z
  .union([z.literal(''), integerString])
  .transform((value): number | null => (value === '' ? null : Number(value)));

export const productFormSchema = z.object({
  name: z.string().trim().min(2, 'nameMin').max(50, 'nameMax'),
  sku: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9-]{5,20}$/, 'skuFormat'),
  categoryId: z.string().uuid('categoryRequired'),
  description: z.string().max(200, 'descriptionMax'),
  price: money,
  cost: money,
  wholesalePrice: optionalMoney,
  wholesaleMinQuantity: optionalInteger,
  stock: integerString.transform((value): number => Number(value)),
  isVatExempt: z
    .enum(['', 'on', 'true', 'false'], { message: 'booleanFormat' })
    .transform((value): boolean => value === 'on' || value === 'true'),
  uploadedImagePaths: z.array(z.string()).max(PRODUCT_IMAGE_MAX_COUNT, 'imageCount'),
  existingImages: z.array(z.string().url('imageFormat')).max(PRODUCT_IMAGE_MAX_COUNT, 'imageCount'),
});

export const updateProductFormSchema = productFormSchema.extend({
  productId: z.string().uuid('invalidRequest'),
  expectedVersion: integerString.transform((value): number => Number(value)),
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
