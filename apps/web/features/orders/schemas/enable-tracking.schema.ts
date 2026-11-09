import { z } from 'zod';
export const enableTrackingSchema = z.object({
  orderId: z.string().uuid(),
  version: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)),
});
