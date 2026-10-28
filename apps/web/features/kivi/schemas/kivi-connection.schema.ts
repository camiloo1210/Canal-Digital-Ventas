import { z } from 'zod';

/** Issue messages are translation keys under KiviConnection.validation. */
export const pairKiviSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'codeRequired')
    .refine((value: string): boolean => !/^kc_/i.test(value), 'codeIsToken')
    .pipe(z.string().regex(/^kvp_[A-Za-z0-9_-]{8,200}$/, 'codeFormat')),
});

export type PairKiviInput = z.infer<typeof pairKiviSchema>;
