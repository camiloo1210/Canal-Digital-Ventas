'use server';

import { createClient } from '@/lib/supabase/server';
import { SupabaseAuthAdapter } from '@canaldigital/packages/core/src/features/iam/infrastructure/adapters/supabase-auth.adapter';
import { GetOAuthSignInUrlUseCase } from '@canaldigital/packages/core/src/features/iam/application/use-cases/get-oauth-sign-in-url.use-case';
import { SignInWithEmailUseCase } from '@canaldigital/packages/core/src/features/iam/application/use-cases/sign-in-with-email.use-case';
import { DomainException } from '@canaldigital/packages/core/src/features/shared/domain/exceptions/domain.exception';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginState = {
  error?: string;
  message?: string;
};

export async function loginWithEmailAction(
  prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get('email');
  const password = formData.get('password');

  const validatedFields = loginSchema.safeParse({ email, password });

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0].message,
    };
  }

  const client = await createClient();
  const adapter = new SupabaseAuthAdapter();
  const useCase = new SignInWithEmailUseCase(adapter);

  try {
    await useCase.execute(validatedFields.data.email, validatedFields.data.password, client);
    // Redirigir al inicio después de login exitoso
  } catch (error) {
    if (error instanceof DomainException) {
      return { error: error.message };
    }
    return { error: 'An unexpected error occurred' };
  }

  redirect('/');
}

export async function loginWithGoogleAction() {
  const client = await createClient();
  const adapter = new SupabaseAuthAdapter();
  const useCase = new GetOAuthSignInUrlUseCase(adapter);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectTo = `${baseUrl}/auth/callback`;

  let url: string;
  try {
    url = await useCase.execute('google', redirectTo, client);
  } catch (error) {
    console.error('Google OAuth Error:', error);
    // Redirigir de vuelta a login con error
    redirect('/login?message=Failed to initialize Google login');
  }

  redirect(url);
}
