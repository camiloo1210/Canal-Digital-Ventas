import { z } from 'zod';

export const StartPaymentSchema = z.object({ orderId: z.string().uuid() });
