'use server';

import { z } from 'zod';
import { getSignInWithEmailUseCase, getGetOAuthSignInUrlUseCase } from '@/features/iam/di/iam.di';
import { DomainException, ApplicationException } from '@canaldigital/packages/core';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export type ActionState = {
  success: boolean;
  error: string | null;
};

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function loginWithEmailAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // TODO: Add rate-limiting here (e.g., via upstash/ratelimit to prevent brute force attacks)

  const email = formData.get('email');
  const password = formData.get('password');

  // Parse, don't validate at the Server Action boundary
  const validatedFields = loginSchema.safeParse({ email, password });

  if (!validatedFields.success) {
    return {
      success: false,
      error: validatedFields.error.issues[0]?.message || 'Invalid input provided.',
    };
  }

  let success = false;
  let needsOnboarding = false;

  try {
    const useCase = await getSignInWithEmailUseCase();

    await useCase.execute({
      email: validatedFields.data.email,
      password: validatedFields.data.password,
    });

    success = true;
  } catch (error: unknown) {
    // Return domain specific exceptions with a safe message
    if (error instanceof DomainException || error instanceof ApplicationException) {
      if (error.name === 'TenantNotConfiguredException') {
        needsOnboarding = true;
      } else {
        return { success: false, error: (error as Error).message };
      }
    } else {
      // Log unexpected errors internally without leaking stack traces to the client
      console.error('Unexpected login error:', error);

      return {
        success: false,
        error: 'An unexpected error occurred during sign in. Please try again later.',
      };
    }
  }

  if (needsOnboarding) {
    redirect('/onboarding');
  }

  if (success) {
    redirect('/dashboard');
  }

  return { success: false, error: null };
}

export async function loginWithGoogleAction() {
  let url: string;
  try {
    const useCase = await getGetOAuthSignInUrlUseCase();

    // Dynamically derive the base URL from request headers.
    // This works automatically in localhost, Vercel preview, and production.
    const headersList = await headers();
    const host = headersList.get('host');
    const protocol = headersList.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;
    const redirectTo = `${baseUrl}/auth/callback`;

    url = await useCase.execute({
      provider: 'google',
      redirectTo,
    });
  } catch (error: unknown) {
    console.error('Google OAuth Error:', error);
    redirect('/login?message=Failed to initialize Google login');
    return;
  }

  redirect(url);
}
