import { z } from 'zod';

const text = z.string().trim().min(1).max(120);

export const shippingOriginSchema = z.object({
  contactName: text,
  phone: text,
  street: text,
  city: text,
  state: text,
  zipCode: text,
  country: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/),
});

export type ShippingOriginInput = z.infer<typeof shippingOriginSchema>;
