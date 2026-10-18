'use server';

import { z } from 'zod';
import { getCreateCategoryUseCase } from '@/features/dashboard/di/dashboard.di';
import { DomainException } from '@canaldigital/packages/core';

export type ActionState = {
  success: boolean;
  error: string | null;
};

// Zod schema for Quick Add Category
const quickCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  description: z.string().max(255, 'Description is too long').optional().default(''),
});

export async function quickCreateCategoryAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = formData.get('name');
  const description = formData.get('description');

  // Parse, don't validate at the Server Action boundary
  const validatedFields = quickCategorySchema.safeParse({ name, description });

  if (!validatedFields.success) {
    return {
      success: false,
      error: validatedFields.error.issues[0]?.message || 'Invalid input provided.',
    };
  }

  try {
    const useCase = await getCreateCategoryUseCase();

    // We pass a dummy tenantId and id for the dashboard quick action context.
    // In a real app, tenantId comes from the session/context.
    await useCase.execute({
      id: crypto.randomUUID(),
      tenantId: 'default-tenant-id',
      name: validatedFields.data.name,
      description: validatedFields.data.description,
      status: 'active', // Default status
    });

    return { success: true, error: null };
  } catch (error: unknown) {
    // Return domain specific exceptions with a safe message
    if (error instanceof DomainException) {
      return { success: false, error: error.message };
    }

    console.error('Unexpected error creating category from dashboard:', error);

    return {
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
    };
  }
}
