import { z } from 'zod';

export const changeOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['processing', 'shipped', 'delivered']),
  expectedVersion: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)),
});
