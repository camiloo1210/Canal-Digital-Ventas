'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import {
  getRegisterGlobalIdentityUseCase,
  getOnboardTenantUseCase,
} from '@/features/iam/di/iam.di';
import { DomainException, ApplicationException } from '@canaldigital/packages/core';

export type ActionState = {
  success: boolean;
  error: string | null;
};

const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  storeName: z.string().min(1, 'Store name is required'),
  storeSlug: z.string().min(1, 'Store URL is required'),
});

export async function signupBusinessAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const data = Object.fromEntries(formData.entries());
  const validatedFields = signupSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      error: validatedFields.error.issues[0]?.message || 'Invalid input provided.',
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

    await onboardUseCase.execute(
      {
        tenantId,
        name: validatedFields.data.storeName,
        slug: validatedFields.data.storeSlug,
        contactEmail: validatedFields.data.email,
        userEmail: validatedFields.data.email,
        firstName: validatedFields.data.firstName,
        lastName: validatedFields.data.lastName,
      },
      currentUserId,
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

const customerSignupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function signupCustomerAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const data = Object.fromEntries(formData.entries());
  const validatedFields = customerSignupSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      error: validatedFields.error.issues[0]?.message || 'Invalid input provided.',
    };
  }

  try {
    const registerUseCase = await getRegisterGlobalIdentityUseCase();
    await registerUseCase.execute({
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

  // Success! Send to Storefront (Root)
  redirect('/');
}
