import { z } from 'zod';

export const kiviWhatsAppSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('disconnect') }),
  z.object({
    operation: z.enum(['validate', 'connect']),
    phoneNumberId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    token: z.string().min(1).max(1024).regex(/^\S+$/),
  }),
]);
