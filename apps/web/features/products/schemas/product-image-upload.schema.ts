import { z } from 'zod';
import { PRODUCT_IMAGE_MAX_COUNT } from '@/features/products/schemas/product-form.schema';

export const productImageUploadsSchema = z.object({
  contentTypes: z
    .array(z.enum(['image/jpeg', 'image/png', 'image/webp']))
    .min(1)
    .max(PRODUCT_IMAGE_MAX_COUNT),
});

export type ProductImageUploadErrorCode = 'UNAUTHORIZED' | 'INVALID_INPUT' | 'UNEXPECTED';

export interface ProductImageUploadSlot {
  path: string;
  token: string;
}

export type ProductImageUploadsResult =
  | { success: true; uploads: ProductImageUploadSlot[] }
  | { success: false; errorCode: ProductImageUploadErrorCode; message: string };
