import { z } from 'zod';
import {
  DOCUMENT_ID_INPUT,
  FULL_NAME_INPUT,
  PHONE_INPUT,
  PLACE_NAME_INPUT,
  POSTAL_CODE_INPUT,
  inputPatternRegex,
  type TextInputAttributes,
} from '@/lib/input-attributes';

interface CheckoutFieldDefinition {
  name: string;
  label: string;
  autoComplete: string;
  type: 'text' | 'email' | 'tel';
  section: 'customer' | 'shipping';
  /** Native constraints; the schema below is built from the same attributes. */
  input?: TextInputAttributes;
}

export const checkoutFields = [
  {
    name: 'customer.name',
    label: 'name',
    autoComplete: 'name',
    type: 'text',
    section: 'customer',
    input: FULL_NAME_INPUT,
  },
  {
    name: 'customer.email',
    label: 'email',
    autoComplete: 'email',
    type: 'email',
    section: 'customer',
  },
  {
    name: 'customer.phone',
    label: 'phone',
    autoComplete: 'tel',
    type: 'tel',
    section: 'customer',
    input: PHONE_INPUT,
  },
  {
    name: 'customer.documentId',
    label: 'documentId',
    autoComplete: 'off',
    type: 'text',
    section: 'customer',
    input: DOCUMENT_ID_INPUT,
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
    input: PLACE_NAME_INPUT,
  },
  {
    name: 'shipping.state',
    label: 'state',
    autoComplete: 'shipping address-level1',
    type: 'text',
    section: 'shipping',
    input: PLACE_NAME_INPUT,
  },
  {
    name: 'shipping.zipCode',
    label: 'zipCode',
    autoComplete: 'shipping postal-code',
    type: 'text',
    section: 'shipping',
    input: POSTAL_CODE_INPUT,
  },
  {
    name: 'shipping.country',
    label: 'country',
    autoComplete: 'shipping country-name',
    type: 'text',
    section: 'shipping',
    input: PLACE_NAME_INPUT,
  },
  {
    name: 'shipping.reference',
    label: 'reference',
    autoComplete: 'off',
    type: 'text',
    section: 'shipping',
  },
] as const satisfies readonly CheckoutFieldDefinition[];

export type CheckoutFieldName = (typeof checkoutFields)[number]['name'];
export type CheckoutValues = Record<CheckoutFieldName, string>;

const required = z.string().trim().min(1).max(500);
/** Required text that must match the field's native constraint, so form and server agree. */
function constrained(attributes: TextInputAttributes): z.ZodString {
  return z.string().trim().max(attributes.maxLength).regex(inputPatternRegex(attributes));
}

/** Translation key (under Storefront.checkout) of the message for an invalid field. */
export function checkoutFieldMessageKey(name: CheckoutFieldName): string {
  switch (name) {
    case 'customer.email':
      return 'invalidEmail';
    case 'customer.name':
      return 'invalidName';
    case 'customer.phone':
      return 'invalidPhone';
    case 'customer.documentId':
      return 'invalidDocumentId';
    case 'shipping.zipCode':
      return 'invalidZipCode';
    case 'shipping.city':
    case 'shipping.state':
    case 'shipping.country':
      return 'invalidPlace';
    default:
      return 'invalidField';
  }
}
export const CheckoutDetailsSchema = z.object({
  'customer.name': constrained(FULL_NAME_INPUT),
  'customer.email': z.string().trim().email().max(254),
  'customer.phone': constrained(PHONE_INPUT),
  'customer.documentId': constrained(DOCUMENT_ID_INPUT),
  'shipping.street': required,
  'shipping.city': constrained(PLACE_NAME_INPUT),
  'shipping.state': constrained(PLACE_NAME_INPUT),
  'shipping.zipCode': constrained(POSTAL_CODE_INPUT),
  'shipping.country': constrained(PLACE_NAME_INPUT),
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
