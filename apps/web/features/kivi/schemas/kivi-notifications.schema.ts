import { z } from 'zod';

export const kiviNotificationsSchema = z.object({
  whatsappEnabled: z.boolean(),
  widgetEnabled: z.boolean(),
  templateName: z.string().regex(/^[a-z][a-z0-9_]{0,99}$/),
  language: z.string().regex(/^(?:es|en)(?:_[A-Z]{2})?(?![\s\S])/),
});
