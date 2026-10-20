import { z } from 'zod';
import { parseToMinorUnits } from '@/lib/money';

export const PRODUCT_IMAGE_MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

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
  image: z
    .instanceof(File, { message: 'imageFormat' })
    .refine(
      (file): boolean => Object.hasOwn(PRODUCT_IMAGE_MIME_EXTENSIONS, file.type),
      'imageFormat',
    )
    .refine((file): boolean => file.size <= PRODUCT_IMAGE_MAX_BYTES, 'imageSize')
    .optional(),
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
