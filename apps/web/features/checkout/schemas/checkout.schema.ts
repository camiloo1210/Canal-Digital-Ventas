import { z } from 'zod';

export const checkoutFields = [
  { name: 'customer.name', label: 'name', autoComplete: 'name', type: 'text', section: 'customer' },
  {
    name: 'customer.email',
    label: 'email',
    autoComplete: 'email',
    type: 'email',
    section: 'customer',
  },
  { name: 'customer.phone', label: 'phone', autoComplete: 'tel', type: 'tel', section: 'customer' },
  {
    name: 'customer.documentId',
    label: 'documentId',
    autoComplete: 'off',
    type: 'text',
    section: 'customer',
  },
  {
    name: 'shipping.street',
    label: 'street',
    autoComplete: 'shipping street-address',
    type: 'text',
    section: 'shipping',
  },
  {
    name: 'shipping.city',
    label: 'city',
    autoComplete: 'shipping address-level2',
    type: 'text',
    section: 'shipping',
  },
  {
    name: 'shipping.state',
    label: 'state',
    autoComplete: 'shipping address-level1',
    type: 'text',
    section: 'shipping',
  },
  {
    name: 'shipping.zipCode',
    label: 'zipCode',
    autoComplete: 'shipping postal-code',
    type: 'text',
    section: 'shipping',
  },
  {
    name: 'shipping.country',
    label: 'country',
    autoComplete: 'shipping country-name',
    type: 'text',
    section: 'shipping',
  },
  {
    name: 'shipping.reference',
    label: 'reference',
    autoComplete: 'off',
    type: 'text',
    section: 'shipping',
  },
] as const;

export type CheckoutFieldName = (typeof checkoutFields)[number]['name'];
export type CheckoutValues = Record<CheckoutFieldName, string>;

const required = z.string().trim().min(1).max(500);
export const CheckoutDetailsSchema = z.object({
  'customer.name': required,
  'customer.email': z.string().trim().email().max(254),
  'customer.phone': required,
  'customer.documentId': required,
  'shipping.street': required,
  'shipping.city': required,
  'shipping.state': required,
  'shipping.zipCode': required,
  'shipping.country': required,
  'shipping.reference': z.string().max(500),
});

export const CartItemsSchema = z
  .string()
  .transform((value, ctx): unknown => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid JSON payload' });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(
        z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(9999) }),
      )
      .min(1)
      .max(100),
  )
  .refine(
    (items): boolean => new Set(items.map((item): string => item.productId)).size === items.length,
  );

export interface CheckoutActionState {
  success: boolean;
  errorCode:
    | 'OUT_OF_STOCK'
    | 'PRODUCT_UNAVAILABLE'
    | 'INVALID_CART'
    | 'INVALID_INPUT'
    | 'UNAUTHORIZED'
    | 'TENANT_NOT_FOUND'
    | 'UNEXPECTED'
    | null;
  errorParams?: Record<string, string | number>;
  message?: string;
  values?: CheckoutValues;
  fieldErrors?: Partial<Record<CheckoutFieldName, string>>;
  submissionId?: string;
}
