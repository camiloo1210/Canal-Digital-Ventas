import { z } from 'zod';

const text = z.string().trim().min(1).max(120);

export const shippingOriginSchema = z.object({
  contactName: text,
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[+(]?\d[\d ()-]{5,18}\d$/),
  street: text,
  city: text,
  state: text,
  zipCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/),
  country: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/),
});

export type ShippingOriginInput = z.infer<typeof shippingOriginSchema>;
