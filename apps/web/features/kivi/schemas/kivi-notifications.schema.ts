import { z } from 'zod';

export const kiviNotificationsSchema = z.object({
  whatsappEnabled: z.boolean(),
  widgetEnabled: z.boolean(),
  templateName: z.string().regex(/^[a-z][a-z0-9_]{0,99}$/),
  language: z.enum(['es', 'en']),
});
