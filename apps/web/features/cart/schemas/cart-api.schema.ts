import { z } from 'zod';

export const CART_MAX_LINES = 50;
export const CART_MAX_QUANTITY = 99;
export const CART_MAX_BODY_BYTES = 16 * 1024;

export const TenantSlugSchema = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/);

const ItemsSchema = z
  .array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().min(1).max(CART_MAX_QUANTITY),
    }),
  )
  .max(CART_MAX_LINES)
  .refine(
    (items): boolean => new Set(items.map((item): string => item.productId)).size === items.length,
  );

export const CartQuerySchema = z.object({ tenant: TenantSlugSchema });

export const CartSyncBodySchema = z.object({
  tenant: TenantSlugSchema,
  items: ItemsSchema,
  baseVersion: z.number().int().min(0).nullable(),
});

export const CartMergeBodySchema = z.object({
  tenant: TenantSlugSchema,
  items: ItemsSchema,
});
