import { z } from 'zod';

export const shipmentJobActionSchema = z.object({
  orderId: z.string().uuid(),
});
