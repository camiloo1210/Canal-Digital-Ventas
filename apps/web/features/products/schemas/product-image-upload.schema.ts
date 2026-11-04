import { z } from 'zod';
import { PRODUCT_IMAGE_MAX_COUNT } from '@/features/products/schemas/product-form.schema';

export const productImageUploadsSchema = z.object({
  contentTypes: z
    .array(z.enum(['image/jpeg', 'image/png', 'image/webp']))
    .min(1)
    .max(PRODUCT_IMAGE_MAX_COUNT),
  /** The business the form was rendered for; verified server-side, never trusted. */
  tenantId: z.string().max(64).optional(),
});

export type ProductImageUploadErrorCode =
  'UNAUTHORIZED' | 'INVALID_INPUT' | 'CONTEXT_CHANGED' | 'UNEXPECTED';

export interface ProductImageUploadSlot {
  path: string;
  token: string;
}

export type ProductImageUploadsResult =
  | { success: true; uploads: ProductImageUploadSlot[] }
  | { success: false; errorCode: ProductImageUploadErrorCode; message: string };
