'use server';

import { z } from 'zod';
import { getOnboardTenantUseCase } from '@/features/iam/di/iam.di';
import { DomainException, ApplicationException } from '@canaldigital/packages/core';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type ActionState = {
  success: boolean;
  error: string | null;
};

// Parse, Don't Validate: Only validates the shape of the UI payload
const onboardingSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  storeName: z.string().min(3, 'Store name must be at least 3 characters'),
  storeSlug: z
    .string()
    .min(3, 'Store slug must be at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
});

export async function onboardBusinessAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // 1. Zod parsea SOLO datos del formulario (Nombre, Tienda, etc)
  const parsed = onboardingSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid input provided.',
    };
  }

  let success = false;

  try {
    // 2. SEGURIDAD CRÍTICA: Obtenemos el ID del usuario directamente de la sesión (No puede ser falsificado)
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('You are not authenticated.');
    }

    // We generate a tenant ID using crypto (or could use uuid library)
    const tenantId = crypto.randomUUID();
    const useCase = await getOnboardTenantUseCase();

    // 3. Pasamos el userId verificado por separado al Caso de Uso
    await useCase.execute(
      {
        tenantId,
        name: parsed.data.storeName,
        slug: parsed.data.storeSlug,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        contactEmail: user.email!, // Use authenticated user's email
        userEmail: user.email!,
      },
      user.id,
    );

    success = true;
  } catch (error: unknown) {
    if (error instanceof DomainException || error instanceof ApplicationException) {
      return { success: false, error: (error as Error).message };
    }

    console.error('Unexpected onboarding error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred during onboarding. Please try again later.',
    };
  }

  // 4. Redirect SIEMPRE fuera del try/catch
  if (success) {
    redirect('/dashboard');
  }

  return { success: false, error: null };
}
