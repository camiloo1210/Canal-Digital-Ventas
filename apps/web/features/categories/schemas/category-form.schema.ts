import { z } from 'zod';

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'validation_name_required').max(100, 'validation_name_maxLength'),
  description: z.string().max(200, 'validation_description_maxLength'),
});
export const updateCategoryFormSchema = categoryFormSchema.extend({
  categoryId: z.string().uuid(),
  expectedVersion: z
    .string()
    .regex(/^\d+$/)
    .refine((value): boolean => Number.isSafeInteger(Number(value)))
    .transform((value): number => Number(value)),
});

export interface CategoryFormValues {
  name: string;
  description: string;
}
export type CategoryFieldErrors = Partial<Record<keyof CategoryFormValues, string[]>>;
export interface CategoryActionState {
  success: boolean;
  error: string | null;
  fieldErrors?: CategoryFieldErrors;
  values?: CategoryFormValues;
  revision?: number;
}

export function extractCategoryFormValues(formData: FormData): CategoryFormValues {
  const name = formData.get('name');
  const description = formData.get('description');
  return {
    name: typeof name === 'string' ? name : '',
    description: typeof description === 'string' ? description : '',
  };
}
