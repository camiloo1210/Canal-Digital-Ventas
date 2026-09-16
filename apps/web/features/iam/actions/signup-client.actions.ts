'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { getRegisterGlobalIdentityUseCase } from '@/features/iam/di/iam.di';
import { DomainException, ApplicationException } from '@canaldigital/packages/core';
import { ActionState } from '@/features/iam/actions/signup.actions';

const signupClientSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function signupClientAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = formData.get('email');
  const password = formData.get('password');
  const tenantSlug = formData.get('tenantSlug'); // Optional: Which store they came from

  const validatedFields = signupClientSchema.safeParse({ email, password });

  if (!validatedFields.success) {
    return {
      success: false,
      error: validatedFields.error.issues[0]?.message || 'Invalid input provided.',
    };
  }

  let success = false;
  let redirectUrl = '/buyer-dashboard';

  try {
    const useCase = await getRegisterGlobalIdentityUseCase();

    await useCase.execute({
      email: validatedFields.data.email,
      password: validatedFields.data.password,
    });

    success = true;
    if (tenantSlug && typeof tenantSlug === 'string') {
      redirectUrl = `/store/${tenantSlug}`;
    }
  } catch (error: unknown) {
    if (error instanceof DomainException || error instanceof ApplicationException) {
      return { success: false, error: (error as Error).message };
    }

    console.error('Unexpected signup error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred during signup. Please try again later.',
    };
  }

  if (success) {
    redirect(redirectUrl);
  }

  return { success: false, error: null };
}
