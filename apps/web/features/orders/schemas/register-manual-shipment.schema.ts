import { z } from 'zod';
export const registerManualShipmentSchema = z.object({
  orderId: z.string().uuid(),
  version: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)),
  carrier: z.string().max(120),
  trackingNumber: z.string().max(120),
});
