'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { getRegisterGlobalIdentityUseCase } from '@/features/iam/di/iam.di';
import { DomainException, ApplicationException } from '@canaldigital/packages/core';

export type ActionState = {
  success: boolean;
  error: string | null;
};

const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function signupBusinessAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = formData.get('email');
  const password = formData.get('password');

  const validatedFields = signupSchema.safeParse({ email, password });

  if (!validatedFields.success) {
    return {
      success: false,
      error: validatedFields.error.issues[0]?.message || 'Invalid input provided.',
    };
  }

  let success = false;

  try {
    const useCase = await getRegisterGlobalIdentityUseCase();

    await useCase.execute({
      email: validatedFields.data.email,
      password: validatedFields.data.password,
    });

    success = true;
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
    redirect('/onboarding');
  }

  return { success: false, error: null };
}
