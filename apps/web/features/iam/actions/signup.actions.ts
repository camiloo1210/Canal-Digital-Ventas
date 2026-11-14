'use server';

import { getTranslations } from 'next-intl/server';
import { authenticationLimitMessage } from '@/lib/security/authentication-rate-limit';
import { redirect } from 'next/navigation';
import {
  getRegisterGlobalIdentityUseCase,
  getOnboardTenantUseCase,
} from '@/features/iam/di/iam.di';
import { DomainException, ApplicationException } from '@canaldigital/packages/core';
import { buyerAuthHref, safeAuthReturnPath } from '@/features/iam/utils/auth-return-path';
import { createClient } from '@/lib/supabase/server';
import { customerSignupSchema, signupBusinessSchema } from '@/features/iam/schemas/auth.schema';
import { ONBOARDING_BASE_CURRENCY } from '@/features/iam/constants';

export type ActionState = {
  success: boolean;
  error: string | null;
};

export async function signupBusinessAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const limitMessage = await authenticationLimitMessage();
  if (limitMessage) return { success: false, error: limitMessage };
  const t = await getTranslations('Storefront.auth.errors');
  const data = Object.fromEntries(formData.entries());
  const validatedFields = signupBusinessSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      error: t(validatedFields.error.issues[0]?.message ?? 'email'),
    };
  }

  let currentUserId: string;

  // 1. Create Global Identity (Supabase Auth User)
  try {
    const registerUseCase = await getRegisterGlobalIdentityUseCase();
    currentUserId = await registerUseCase.execute({
      email: validatedFields.data.email,
      password: validatedFields.data.password,
    });
  } catch (error: unknown) {
    if (error instanceof DomainException || error instanceof ApplicationException) {
      return { success: false, error: (error as Error).message };
    }
    console.error('Unexpected auth error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred during registration. Please try again.',
    };
  }

  let onboardingError: string | null = null;

  // 2. Onboard Tenant (Create Business Store & Membership)
  try {
    const onboardUseCase = await getOnboardTenantUseCase();
    const tenantId = crypto.randomUUID();
    const idempotencyKey = crypto.randomUUID(); // Idempotency key for atomic onboarding

    await onboardUseCase.execute(
      {
        tenantId,
        name: validatedFields.data.storeName,
        slug: validatedFields.data.storeSlug,
        contactEmail: validatedFields.data.email,
        userEmail: validatedFields.data.email,
        firstName: validatedFields.data.firstName,
        lastName: validatedFields.data.lastName,
        baseCurrency: ONBOARDING_BASE_CURRENCY,
      },
      currentUserId,
      idempotencyKey,
    );
  } catch (error: unknown) {
    // Distributed Transaction Failure:
    // The user was created, but tenant creation failed (e.g., Slug already in use).
    // The user is effectively logged in but without a tenant context.
    // We redirect them to the universal /onboarding page to fix the issue.
    if (error instanceof DomainException || error instanceof ApplicationException) {
      onboardingError = encodeURIComponent((error as Error).message);
    } else {
      console.error('Unexpected onboarding error:', error);
      onboardingError = 'Unexpected_Error_Setting_Up_Store';
    }
  }

  if (onboardingError) {
    redirect(`/onboarding?error=${onboardingError}`);
  }

  // Success! Send to Dashboard
  redirect('/dashboard');
}

export async function signupCustomerAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const limitMessage = await authenticationLimitMessage();
  if (limitMessage) return { success: false, error: limitMessage };
  const t = await getTranslations('Storefront.auth.errors');
  const data = Object.fromEntries(formData.entries());
  const validatedFields = customerSignupSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      error: t(validatedFields.error.issues[0]?.message ?? 'email'),
    };
  }

  try {
    const registerUseCase = await getRegisterGlobalIdentityUseCase();
    await registerUseCase.execute({
      email: validatedFields.data.email,
      password: validatedFields.data.password,
    });
  } catch (error: unknown) {
    console.error('Unexpected auth error:', error);
    return {
      success: false,
      error: t('registration'),
    };
  }

  const destination = safeAuthReturnPath(formData.get('redirectTo'));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Email confirmation may be required before a session exists.
  redirect(user ? destination : `${buyerAuthHref('/login', destination)}&notice=confirmEmail`);
}
