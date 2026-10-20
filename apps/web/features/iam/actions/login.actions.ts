'use server';

import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { getSignInWithEmailUseCase, getGetOAuthSignInUrlUseCase } from '@/features/iam/di/iam.di';
import { InvalidCredentialsException } from '@canaldigital/packages/core';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { safeAuthReturnPath, buyerAuthHref } from '@/features/iam/utils/auth-return-path';

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

  const t = await getTranslations('Storefront.auth.errors');
  const email = formData.get('email');
  const password = formData.get('password');

  // Parse, don't validate at the Server Action boundary
  const validatedFields = loginSchema.safeParse({ email, password });

  if (!validatedFields.success) {
    return {
      success: false,
      error: t(validatedFields.error.issues[0]?.path[0] === 'email' ? 'email' : 'passwordRequired'),
    };
  }

  let success = false;

  try {
    const useCase = await getSignInWithEmailUseCase();

    await useCase.execute({
      email: validatedFields.data.email,
      password: validatedFields.data.password,
    });

    success = true;
  } catch (error: unknown) {
    if (error instanceof InvalidCredentialsException) {
      return { success: false, error: t('credentials') };
    }
    console.error('Unexpected login error:', error);
    return { success: false, error: t('unexpected') };
  }

  if (success) {
    // With no buyer return, the authenticated login route resolves the role via memberships.
    redirect(safeAuthReturnPath(formData.get('redirectTo'), '/login'));
  }

  return { success: false, error: null };
}

import { cookies } from 'next/headers';
import { OAUTH_INTENT_COOKIE, OAUTH_RETURN_COOKIE } from '@/features/iam/constants';

async function setOAuthIntentCookie(intent: 'business' | 'customer'): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_INTENT_COOKIE, intent, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });
}

export async function loginWithGoogleAction(formData?: FormData): Promise<void> {
  await setOAuthIntentCookie('customer');
  const returnPath = safeAuthReturnPath(formData?.get('redirectTo'));
  const cookieStore = await cookies();
  if (formData?.get('redirectTo'))
    cookieStore.set(OAUTH_RETURN_COOKIE, returnPath, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/',
    });
  else cookieStore.delete(OAUTH_RETURN_COOKIE);

  let errorMessage: string | null = null;
  let url: string | null = null;
  try {
    const useCase = await getGetOAuthSignInUrlUseCase();

    // Dynamically derive the base URL from request headers.
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
    errorMessage = 'google_oauth_init_failed';
  }

  if (errorMessage || !url) {
    redirect(`${buyerAuthHref('/login', returnPath)}&error=${errorMessage || 'unknown'}`);
  }

  redirect(url);
}

export async function loginBusinessWithGoogleAction(): Promise<void> {
  await setOAuthIntentCookie('business');
  (await cookies()).delete(OAUTH_RETURN_COOKIE);

  let errorMessage: string | null = null;
  let url: string | null = null;
  try {
    const useCase = await getGetOAuthSignInUrlUseCase();

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
    errorMessage = 'google_oauth_init_failed';
  }

  if (errorMessage || !url) {
    redirect(`/signup/business?error=${errorMessage || 'unknown'}`);
  }

  redirect(url);
}
