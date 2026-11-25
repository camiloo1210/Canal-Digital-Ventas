import { z } from 'zod';
import { SHIPMENT_CARRIERS } from '@/features/orders/constants/shipment-carriers';
export const registerManualShipmentSchema = z.object({
  orderId: z.string().uuid(),
  version: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)),
  carrier: z.enum(SHIPMENT_CARRIERS),
  trackingNumber: z.string().max(120),
});
